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

# SINGLE APP INSTANCE
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

# ===================== PYDANTIC MODELS (Full CMS & Admin) =====================

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

class PrettyLinkCreate(BaseModel):
    slug: str
    destination_url: str
    title: Optional[str] = None

class PageCreate(BaseModel):
    slug: str
    title: str
    content: str
    is_published: bool = True

class BlogPostCreate(BaseModel):
    slug: str
    title: str
    excerpt: str
    content: str
    is_published: bool = True

# ===================== AUTH & UTILS =====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str):
    payload = {"user_id": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(payload, os.getenv("JWT_SECRET", "secret_2026"), algorithm="HS256")

async def get_admin_user(request: Request):
    # Verified admin logic can be added here
    return True

# ===================== ADMIN PANEL (RESTORED ALL FEATURES) =====================

@api_router.get("/analytics/overview")
async def get_analytics_overview(request: Request):
    await get_admin_user(request)
    return {
        "total_coupons": await db.coupons.count_documents({}),
        "active_coupons": await db.coupons.count_documents({"is_active": True}),
        "total_clicks": await db.clicks.count_documents({}),
        "total_users": await db.users.count_documents({}),
        "total_pages": await db.pages.count_documents({}),
        "total_blog_posts": await db.blog_posts.count_documents({})
    }

@api_router.post("/coupons/bulk-upload")
async def bulk_upload(file: UploadFile = File(...), request: Request = None):
    if request: await get_admin_user(request)
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    count = 0
    for row in reader:
        row["created_at"] = datetime.now(timezone.utc)
        row["is_active"] = True
        row["clicks"] = 0
        await db.coupons.insert_one(row)
        count += 1
    return {"message": f"Processed {count} coupons"}

# ===================== CMS & BLOG ROUTES (RESTORED) =====================

@api_router.get("/pages")
async def get_pages():
    pages = await db.pages.find().to_list(100)
    for p in pages: p["id"] = str(p.pop("_id"))
    return pages

@api_router.post("/pages")
async def create_page(data: PageCreate, request: Request):
    await get_admin_user(request)
    doc = data.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.pages.insert_one(doc)
    return {"id": str(result.inserted_id), **doc}

@api_router.get("/blog")
async def get_blog():
    posts = await db.blog_posts.find().to_list(100)
    for p in posts: p["id"] = str(p.pop("_id"))
    return posts

# ===================== PRETTY LINKS (AFFILIATE) =====================

@api_router.post("/pretty-links")
async def create_pretty_link(data: PrettyLinkCreate, request: Request):
    await get_admin_user(request)
    doc = data.model_dump()
    doc["clicks"] = 0
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.pretty_links.insert_one(doc)
    return {"id": str(result.inserted_id), "short_url": f"/go/{data.slug}"}

@app.get("/go/{slug}")
async def redirect_link(slug: str):
    link = await db.pretty_links.find_one({"slug": slug})
    if not link: raise HTTPException(status_code=404)
    await db.pretty_links.update_one({"_id": link["_id"]}, {"$inc": {"clicks": 1}})
    return RedirectResponse(url=link["destination_url"])

# ===================== PUBLIC ROUTES =====================

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user["_id"]), user["email"])
    return {"token": token, "user": {"id": str(user["_id"]), "email": user["email"], "role": "admin"}}

@api_router.get("/categories")
async def get_categories():
    categories = await db.categories.find().to_list(100)
    for cat in categories:
        cat["id"] = str(cat.pop("_id"))
        cat["deal_count"] = await db.coupons.count_documents({"category_name": cat["name"]})
    return categories

@api_router.get("/coupons")
async def get_coupons(limit: int = 50):
    coupons = await db.coupons.find({"is_active": True}).limit(limit).to_list(limit)
    for c in coupons: c["id"] = str(c.pop("_id"))
    return coupons

# ===================== FINAL APP SETUP =====================

app.include_router(api_router, prefix="/api")
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# THE CORS FIX (REPLACED WILDCARD '*' WITH EXACT ORIGINS)
origins = [
    "https://disccart.in",
    "https://www.disccart.in",
    "http://localhost:5173",
    "http://localhost:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # EXACT DOMAINS, NOT "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    admin_email = "disccartindia@gmail.com"
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password("Admin@2026@"),
            "role": "admin", "name": "Admin", "created_at": datetime.now(timezone.utc)
        })
    logger.info("🚀 DISCCART API LIVE")

@app.on_event("shutdown")
async def shutdown():
    client.close()
    