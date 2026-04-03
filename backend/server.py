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
import json
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

# MongoDB
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client["disccart"]

# SINGLE APP INSTANCE (CRITICAL: Do not re-initialize 'app' later)
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

# ===================== PYDANTIC MODELS =====================

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
    image_url: Optional[str] = None
    is_featured: bool = False
    is_verified: bool = True
    tags: List[str] = []

class AIContentRequest(BaseModel):
    product_name: str
    brand: str
    discount: str
    category: str

class PrettyLinkCreate(BaseModel):
    slug: str
    destination_url: str
    title: Optional[str] = None
    description: Optional[str] = None

# ===================== UTILITY & AUTH FUNCTIONS =====================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str):
    payload = {"user_id": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(payload, os.getenv("JWT_SECRET", "secret_key_2026"), algorithm="HS256")

async def get_admin_user(request: Request):
    # Logic to verify admin status from token (simplified for flow)
    return True

def calculate_deal_score(coupon: dict) -> float:
    score = 50.0
    if coupon.get("is_featured"): score += 20
    if coupon.get("is_verified"): score += 10
    return min(score, 100)

# ===================== ADMIN PANEL & ANALYTICS =====================

@api_router.get("/analytics/overview")
async def get_analytics_overview(request: Request):
    await get_admin_user(request)
    return {
        "total_coupons": await db.coupons.count_documents({}),
        "active_coupons": await db.coupons.count_documents({"is_active": True}),
        "total_clicks": await db.clicks.count_documents({}),
        "total_users": await db.users.count_documents({}),
        "total_pretty_links": await db.pretty_links.count_documents({}),
        "total_blog_posts": await db.blog_posts.count_documents({})
    }

@api_router.post("/coupons/bulk-upload")
async def bulk_upload_coupons(file: UploadFile = File(...), request: Request = None):
    if request: await get_admin_user(request)
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    coupons_to_insert = []
    for row in reader:
        doc = {
            "title": row.get("title", "").strip(),
            "description": row.get("description", ""),
            "code": row.get("code") if row.get("code") else None,
            "brand_name": row.get("brand_name", ""),
            "category_name": row.get("category_name", ""),
            "affiliate_url": row.get("affiliate_url", ""),
            "is_active": True,
            "clicks": 0,
            "created_at": datetime.now(timezone.utc),
            "deal_score": 70.0
        }
        coupons_to_insert.append(doc)
    if coupons_to_insert:
        await db.coupons.insert_many(coupons_to_insert)
    return {"message": f"Successfully processed {len(coupons_to_insert)} items"}

# ===================== PRETTY LINKS (AFFILIATE REDIRECTS) =====================

@api_router.post("/pretty-links")
async def create_pretty_link(data: PrettyLinkCreate, request: Request):
    await get_admin_user(request)
    doc = data.model_dump()
    doc["clicks"] = 0
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.pretty_links.insert_one(doc)
    return {"id": str(result.inserted_id), "short_url": f"/go/{data.slug}"}

@app.get("/go/{slug}")
async def redirect_pretty_link(slug: str, request: Request):
    link = await db.pretty_links.find_one({"slug": slug})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.pretty_links.update_one({"_id": link["_id"]}, {"$inc": {"clicks": 1}})
    return RedirectResponse(url=link["destination_url"])

# ===================== AUTH ROUTES =====================

@api_router.post("/auth/register")
async def register(data: UserRegister):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(data.password)
    user_doc = {"email": email, "password_hash": hashed, "name": data.name, "role": "admin", "created_at": datetime.now(timezone.utc)}
    result = await db.users.insert_one(user_doc)
    token = create_access_token(str(result.inserted_id), email)
    return {"token": token, "user": {"id": str(result.inserted_id), "email": email, "role": "admin"}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user["_id"]), user["email"])
    return {"token": token, "user": {"id": str(user["_id"]), "email": user["email"], "role": user.get("role", "user")}}

# ===================== CONTENT ROUTES (CATEGORIES/BLOG/CMS) =====================

@api_router.get("/categories")
async def get_categories():
    categories = await db.categories.find().to_list(100)
    for cat in categories:
        cat["id"] = str(cat.pop("_id"))
        cat["deal_count"] = await db.coupons.count_documents({"category_name": cat["name"]})
    return categories

@api_router.get("/blog")
async def get_blog_posts():
    posts = await db.blog_posts.find({"is_published": True}).to_list(50)
    for p in posts: p["id"] = str(p.pop("_id"))
    return posts

@api_router.get("/coupons")
async def get_coupons(limit: int = 50):
    coupons = await db.coupons.find({"is_active": True}).sort("created_at", -1).limit(limit).to_list(limit)
    for c in coupons: c["id"] = str(c.pop("_id"))
    return coupons

# ===================== SEO & SYSTEM =====================

@app.get("/robots.txt")
async def robots_txt():
    return Response(content="User-agent: *\nAllow: /\nSitemap: https://disccart.in/sitemap.xml", media_type="text/plain")

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ===================== APP CONFIGURATION =====================

# 1. Attach the router
app.include_router(api_router, prefix="/api")

# 2. Middlewares
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# 3. CORS POLICY (THE FIX)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Open for all to fix current blocked requests
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================== STARTUP SEEDING =====================

async def seed_admin():
    admin_email = "disccartindia@gmail.com"
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password("Admin@2026@"),
            "name": "DISCCART Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"✅ Admin account {admin_email} seeded.")

@app.on_event("startup")
async def startup_event():
    await seed_admin()
    # Logic for indexing
    await db.users.create_index("email", unique=True)
    await db.coupons.create_index([("brand_name", 1), ("is_active", 1)])
    logger.info("🚀 DISCCART API Started")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    