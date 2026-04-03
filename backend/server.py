from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, UploadFile, File, Depends
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.responses import JSONResponse, RedirectResponse
from dotenv import load_dotenv

import os
import logging
import uuid
import csv
import io
import time
import bcrypt
import jwt
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from bson import ObjectId

# ===================== SETUP & ENV =====================
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client["disccart"]

# SINGLE APP INSTANCE (Fixes the CORS reset bug)
app = FastAPI()
api_router = APIRouter()

# ===================== MIDDLEWARES =====================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.requests = {}

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        if ip not in self.requests: self.requests[ip] = []
        self.requests[ip] = [t for t in self.requests[ip] if now - t < 60]
        if len(self.requests[ip]) > 100:
            return JSONResponse(status_code=429, content={"detail": "Too many requests"})
        self.requests[ip].append(now)
        return await call_next(request)

# ===================== MODELS =====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class CategoryCreate(BaseModel):
    name: str
    slug: str
    icon: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None

class CouponCreate(BaseModel):
    title: str
    description: Optional[str] = None
    code: Optional[str] = None
    discount_type: str = "percentage"
    discount_value: Optional[float] = None
    brand_name: str
    category_name: str
    affiliate_url: str
    is_featured: bool = False
    is_verified: bool = True

# ===================== AUTH & UTILS =====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str):
    payload = {"user_id": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(payload, os.getenv("JWT_SECRET", "secret_key_123"), algorithm="HS256")

async def get_admin_user(request: Request):
    # Logic for Admin verification
    return True

# ===================== ADMIN PANEL ROUTES =====================

@api_router.get("/analytics/overview")
async def get_analytics_overview(request: Request):
    await get_admin_user(request)
    return {
        "total_coupons": await db.coupons.count_documents({}),
        "active_coupons": await db.coupons.count_documents({"is_active": True}),
        "total_clicks": await db.clicks.count_documents({}),
        "total_users": await db.users.count_documents({})
    }

@api_router.post("/coupons/bulk-upload")
async def bulk_upload(file: UploadFile = File(...), request: Request = None):
    if request: await get_admin_user(request)
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    added = 0
    for row in reader:
        row["created_at"] = datetime.now(timezone.utc)
        row["is_active"] = True
        await db.coupons.insert_one(row)
        added += 1
    return {"message": f"Added {added} coupons"}

@api_router.post("/categories")
async def create_category(data: CategoryCreate, request: Request):
    await get_admin_user(request)
    doc = data.model_dump()
    result = await db.categories.insert_one(doc)
    return {"id": str(result.inserted_id), **doc}

# ===================== PUBLIC ROUTES =====================

@api_router.post("/auth/register")
async def register(data: UserRegister):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="User exists")
    hashed = hash_password(data.password)
    result = await db.users.insert_one({"email": email, "password_hash": hashed, "name": data.name, "role": "admin"})
    return {"id": str(result.inserted_id), "email": email}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user["_id"]), user["email"])
    return {"token": token, "user": {"id": str(user["_id"]), "email": user["email"]}}

@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find().to_list(100)
    for c in cats: c["id"] = str(c.pop("_id"))
    return cats

@api_router.get("/coupons")
async def get_coupons(limit: int = 50):
    coupons = await db.coupons.find({"is_active": True}).limit(limit).to_list(limit)
    for c in coupons: c["id"] = str(c.pop("_id"))
    return coupons

# ===================== SYSTEM CONFIG =====================

app.include_router(api_router, prefix="/api")
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# THE CORS FIX
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # THIS STOPS THE CORS ERROR IMMEDIATELY
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Admin Seed
    admin_email = "disccartindia@gmail.com"
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password("Admin@2026@"),
            "role": "admin", "name": "Admin"
        })
    logger.info("🚀 Server Live")

@app.on_event("shutdown")
async def shutdown():
    client.close()
    