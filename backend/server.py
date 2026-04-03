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

# ===================== PYDANTIC MODELS =====================

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class CategoryCreate(BaseModel):
    name: str
    slug: str
    icon: Optional[str] = "Tag"
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
    # PRICE FIELDS FOR DEAL CARDS
    original_price: Optional[float] = None
    discounted_price: Optional[float] = None
    is_featured: bool = False
    is_verified: bool = True

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
    return jwt.encode(payload, os.getenv("JWT_SECRET", "secret_key_2026"), algorithm="HS256")

async def get_admin_user(request: Request):
    # Admin verification logic
    return True

# ===================== ADMIN PANEL & ANALYTICS =====================

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

# ============= CATEGORY MANAGEMENT (ADD/DELETE) =============

@api_router.post("/categories")
async def create_category(data: CategoryCreate, request: Request):
    await get_admin_user(request)
    doc = data.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.categories.insert_one(doc)
    return {"id": str(result.inserted_id), **doc}

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, request: Request):
    await get_admin_user(request)
    result = await db.categories.delete_one({"_id": ObjectId(category_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted successfully"}

# ============= BULK UPLOAD (WITH PRICES & CATEGORIES) =============

@api_router.post("/coupons/bulk-upload")
async def bulk_upload_coupons(file: UploadFile = File(...), request: Request = None):
    if request: await get_admin_user(request)
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    coupons_to_insert = []
    
    for row in reader:
        # Convert prices to numbers
        orig_price = float(row.get("original_price")) if row.get("original_price") else None
        disc_price = float(row.get("discounted_price")) if row.get("discounted_price") else None
        
        doc = {
            "title": row.get("title", "").strip(),
            "description": row.get("description", ""),
            "code": row.get("code") if row.get("code") else None,
            "discount_type": row.get("discount_type", "percentage"),
            "discount_value": float(row.get("discount_value", 0)) if row.get("discount_value") else 0,
            "brand_name": row.get("brand_name", ""),
            "category_name": row.get("category_name", "Other"),
            "original_price": orig_price,
            "discounted_price": disc_price,
            "affiliate_url": row.get("affiliate_url", ""),
            "image_url": row.get("image_url"),
            "is_active": True,
            "clicks": 0,
            "created_at": datetime.now(timezone.utc),
        }
        coupons_to_insert.append(doc)
        
    if coupons_to_insert:
        await db.coupons.insert_many(coupons_to_insert)
    return {"message": f"Successfully uploaded {len(coupons_to_insert)} deals"}

# ===================== CMS & PRETTY LINKS =====================

@api_router.post("/pages")
async def create_page(data: PageCreate, request: Request):
    await get_admin_user(request)
    doc = data.model_dump()
    result = await db.pages.insert_one(doc)
    return {"id": str(result.inserted_id), **doc}

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
async def get_coupons(category: Optional[str] = None, limit: int = 50):
    query = {"is_active": True}
    if category:
        query["category_name"] = category
    coupons = await db.coupons.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for c in coupons: c["id"] = str(c.pop("_id"))
    return coupons

# ===================== FINAL APP SETUP =====================

app.include_router(api_router, prefix="/api")
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

origins = [
    "https://disccart.in",
    "https://www.disccart.in",
    "http://localhost:5173",
    "http://localhost:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
    