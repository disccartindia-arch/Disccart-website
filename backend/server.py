from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, UploadFile, File, Depends
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

import os
import logging   

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi import FastAPI
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt
import secrets
import csv
import io
import time
from collections import defaultdict
import asyncio

# Load env
load_dotenv()

# MongoDB
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client["disccart"]

# App
app = FastAPI()
api_router = APIRouter()

# Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ===================== PYDANTIC MODELS =====================

# Auth Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str = Field(alias="_id")
    email: str
    name: str
    role: str
    created_at: datetime
    
    model_config = ConfigDict(populate_by_name=True)

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.requests = {}

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host
        now = time.time()

        if ip not in self.requests:
            self.requests[ip] = []

        # keep only last 60 sec requests
        self.requests[ip] = [t for t in self.requests[ip] if now - t < 60]

        if len(self.requests[ip]) > 100:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests"}
            )

        self.requests[ip].append(now)

        return await call_next(request)

# Category Models
class CategoryCreate(BaseModel):
    name: str
    slug: str
    icon: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None

class CategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    icon: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    deal_count: int = 0

# Brand Models
class BrandCreate(BaseModel):
    name: str
    slug: str
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    description: Optional[str] = None
    affiliate_base_url: Optional[str] = None

class BrandResponse(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    description: Optional[str] = None
    deal_count: int = 0

# Coupon/Deal Models
class CouponCreate(BaseModel):
    title: str
    description: Optional[str] = None
    code: Optional[str] = None
    discount_type: str = "percentage"  # percentage, flat, deal
    discount_value: Optional[float] = None
    brand_id: Optional[str] = None
    brand_name: str
    category_id: Optional[str] = None
    category_name: str
    original_price: Optional[float] = None
    discounted_price: Optional[float] = None
    affiliate_url: str
    image_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_featured: bool = False
    is_verified: bool = True
    tags: List[str] = []

class CouponUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    code: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    brand_name: Optional[str] = None
    category_name: Optional[str] = None
    original_price: Optional[float] = None
    discounted_price: Optional[float] = None
    affiliate_url: Optional[str] = None
    image_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_featured: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_active: Optional[bool] = None
    tags: Optional[List[str]] = None

class CouponResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    code: Optional[str] = None
    discount_type: str
    discount_value: Optional[float] = None
    brand_name: str
    category_name: str
    original_price: Optional[float] = None
    discounted_price: Optional[float] = None
    affiliate_url: str
    image_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_featured: bool = False
    is_verified: bool = True
    is_active: bool = True
    tags: List[str] = []
    clicks: int = 0
    created_at: datetime
    deal_score: Optional[float] = None
    verification_status: Optional[str] = "verified"

# Click tracking
class ClickCreate(BaseModel):
    coupon_id: str
    source: Optional[str] = "web"

# AI Content Generation
class AIContentRequest(BaseModel):
    product_name: str
    brand: str
    discount: str
    category: str

class AIContentResponse(BaseModel):
    title: str
    description: str
    hashtags: List[str]
    whatsapp_message: str
    telegram_post: str

# Pretty Link Models
class PrettyLinkCreate(BaseModel):
    slug: str  # e.g., "amazon-deal"
    destination_url: str
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

class PrettyLinkUpdate(BaseModel):
    slug: Optional[str] = None
    destination_url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class PrettyLinkResponse(BaseModel):
    id: str
    slug: str
    destination_url: str
    title: Optional[str] = None
    description: Optional[str] = None
    short_url: str
    clicks: int = 0
    is_active: bool = True
    created_at: datetime
    last_clicked: Optional[datetime] = None

# Page Models (for static pages like Privacy, Terms, etc.)
class PageCreate(BaseModel):
    slug: str
    title: str
    content: str
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    is_published: bool = True

class PageUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    is_published: Optional[bool] = None

class PageResponse(BaseModel):
    id: str
    slug: str
    title: str
    content: str
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    is_published: bool = True
    created_at: datetime
    updated_at: datetime

# Blog Post Models
class BlogPostCreate(BaseModel):
    slug: str
    title: str
    excerpt: str
    content: str
    featured_image: Optional[str] = None
    category: str = "Saving Tips"
    tags: List[str] = []
    meta_description: Optional[str] = None
    is_published: bool = True

class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    featured_image: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    meta_description: Optional[str] = None
    is_published: Optional[bool] = None

class BlogPostResponse(BaseModel):
    id: str
    slug: str
    title: str
    excerpt: str
    content: str
    featured_image: Optional[str] = None
    category: str
    tags: List[str] = []
    meta_description: Optional[str] = None
    is_published: bool = True
    views: int = 0
    created_at: datetime
    updated_at: datetime

# Category Update Model
class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None

# 4. ✅ THEN ROUTE
@api_router.post("/auth/register")
async def register(data: UserRegister):
    email = data.email.lower()

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(data.password)

    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": data.name,
        "role": "admin",
        "created_at": datetime.now(timezone.utc)
    }

    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    access_token = create_access_token(user_id, email)

    return {
        "token": access_token,
        "user": {
            "id": user_id,
            "email": email,
            "name": data.name,
            "role": "admin"
        }
    }

# ===================== AUTH ROUTES =====================

@api_router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(data.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # ✅ FIXED COOKIES
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="None",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="None",
        max_age=604800,
        path="/"
    )
    
    return {"_id": user_id, "email": email, "name": data.name, "role": "user", "created_at": user_doc["created_at"]}


@api_router.post("/auth/login")
async def login(data: UserLogin, request: Request, response: Response):
    email = data.email.lower()
    ip = request.client.host
    identifier = f"{ip}:{email}"
    
    # Check brute force
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        lockout_until = attempts.get("lockout_until")
        if lockout_until and datetime.now(timezone.utc) < lockout_until:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {
                "$inc": {"count": 1},
                "$set": {"lockout_until": datetime.now(timezone.utc) + timedelta(minutes=15)}
            },
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # ✅ SUCCESS LOGIN
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
     

# ===================== CATEGORY ROUTES =====================

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0, "id": {"$toString": "$_id"}, "name": 1, "slug": 1, "icon": 1, "image_url": 1, "description": 1}).to_list(100)
    # Get deal counts using aggregation (optimized single query)
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$category_name", "count": {"$sum": 1}}}
    ]
    counts_cursor = await db.coupons.aggregate(pipeline).to_list(None)
    counts = {c["_id"]: c["count"] for c in counts_cursor}
    for cat in categories:
        cat["deal_count"] = counts.get(cat["name"], 0)
    return categories

@api_router.post("/categories", response_model=CategoryResponse)
async def create_category(data: CategoryCreate, request: Request):
    await get_admin_user(request)
    doc = data.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.categories.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["deal_count"] = 0
    return doc

@api_router.get("/categories/{category_id}")
async def get_category(category_id: str):
    try:
        category = await db.categories.find_one({"_id": ObjectId(category_id)}, {"_id": 0})
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        category["id"] = category_id
        count = await db.coupons.count_documents({"category_name": category["name"], "is_active": True})
        category["deal_count"] = count
        return category
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid category ID")

@api_router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, data: CategoryUpdate, request: Request):
    await get_admin_user(request)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.categories.update_one({"_id": ObjectId(category_id)}, {"$set": update_data})
    category = await db.categories.find_one({"_id": ObjectId(category_id)}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    category["id"] = category_id
    category["deal_count"] = await db.coupons.count_documents({"category_name": category["name"], "is_active": True})
    return category

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, request: Request):
    await get_admin_user(request)
    result = await db.categories.delete_one({"_id": ObjectId(category_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

# ===================== BRAND ROUTES =====================

@api_router.get("/brands", response_model=List[BrandResponse])
async def get_brands():
    brands = await db.brands.find({}, {"_id": 0, "id": {"$toString": "$_id"}, "name": 1, "slug": 1, "logo_url": 1, "website_url": 1, "description": 1}).to_list(100)
    # Get deal counts using aggregation (optimized single query)
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$brand_name", "count": {"$sum": 1}}}
    ]
    counts_cursor = await db.coupons.aggregate(pipeline).to_list(None)
    counts = {b["_id"]: b["count"] for b in counts_cursor}
    for brand in brands:
        brand["deal_count"] = counts.get(brand["name"], 0)
    return brands

@api_router.post("/brands", response_model=BrandResponse)
async def create_brand(data: BrandCreate, request: Request):
    await get_admin_user(request)
    doc = data.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.brands.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["deal_count"] = 0
    return doc

# ===================== COUPON/DEAL ROUTES =====================

@api_router.get("/coupons", response_model=List[CouponResponse])
async def get_coupons(
    category: Optional[str] = None,
    brand: Optional[str] = None,
    featured: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    query = {"is_active": True}
    if category:
        query["category_name"] = {"$regex": category, "$options": "i"}
    if brand:
        query["brand_name"] = {"$regex": brand, "$options": "i"}
    if featured:
        query["is_featured"] = True
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"brand_name": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search.lower()]}}
        ]
    
    pipeline = [
        {"$match": query},
        {"$sort": {"is_featured": -1, "deal_score": -1, "created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$project": {
            "_id": 0,
            "id": {"$toString": "$_id"},
            "title": 1, "description": 1, "code": 1, "discount_type": 1,
            "discount_value": 1, "brand_name": 1, "category_name": 1,
            "original_price": 1, "discounted_price": 1, "affiliate_url": 1,
            "image_url": 1, "expires_at": 1, "is_featured": 1, "is_verified": 1,
            "is_active": 1, "tags": 1, "clicks": 1, "created_at": 1, "deal_score": 1
        }}
    ]
    coupons = await db.coupons.aggregate(pipeline).to_list(limit)
    # Add verification status to each coupon
    for c in coupons:
        c["verification_status"] = get_verification_status(c)
    return coupons

@api_router.get("/coupons-only", response_model=List[CouponResponse])
async def get_coupons_only(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "popular",
    limit: int = 50,
    skip: int = 0
):
    """Get only coupons that have a code (not deals without codes)"""
    query = {"is_active": True, "code": {"$nin": [None, ""]}}
    if category:
        query["category_name"] = {"$regex": category, "$options": "i"}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"brand_name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search.lower()]}}
        ]

    sort_field = {"popular": {"deal_score": -1, "clicks": -1}, "latest": {"created_at": -1}}
    sort_order = sort_field.get(sort_by, sort_field["popular"])

    pipeline = [
        {"$match": query},
        {"$sort": sort_order},
        {"$skip": skip},
        {"$limit": limit},
        {"$project": {
            "_id": 0,
            "id": {"$toString": "$_id"},
            "title": 1, "description": 1, "code": 1, "discount_type": 1,
            "discount_value": 1, "brand_name": 1, "category_name": 1,
            "original_price": 1, "discounted_price": 1, "affiliate_url": 1,
            "image_url": 1, "expires_at": 1, "is_featured": 1, "is_verified": 1,
            "is_active": 1, "tags": 1, "clicks": 1, "created_at": 1, "deal_score": 1
        }}
    ]
    coupons = await db.coupons.aggregate(pipeline).to_list(limit)
    for c in coupons:
        c["verification_status"] = get_verification_status(c)
    return coupons

@api_router.get("/coupons/{coupon_id}", response_model=CouponResponse)
async def get_coupon(coupon_id: str):
    try:
        oid = ObjectId(coupon_id)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid coupon ID format")
    coupon = await db.coupons.find_one({"_id": oid}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    coupon["id"] = coupon_id
    coupon["verification_status"] = get_verification_status(coupon)
    return coupon

@api_router.post("/coupons", response_model=CouponResponse)
async def create_coupon(data: CouponCreate, request: Request):
    await get_admin_user(request)
    doc = data.model_dump()
    doc["is_active"] = True
    doc["clicks"] = 0
    doc["created_at"] = datetime.now(timezone.utc)
    doc["updated_at"] = datetime.now(timezone.utc)
    # Calculate deal score
    doc["deal_score"] = calculate_deal_score(doc)
    result = await db.coupons.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

@api_router.put("/coupons/{coupon_id}", response_model=CouponResponse)
async def update_coupon(coupon_id: str, data: CouponUpdate, request: Request):
    await get_admin_user(request)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.coupons.update_one({"_id": ObjectId(coupon_id)}, {"$set": update_data})
    coupon = await db.coupons.find_one({"_id": ObjectId(coupon_id)}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    coupon["id"] = coupon_id
    return coupon

@api_router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, request: Request):
    await get_admin_user(request)
    result = await db.coupons.delete_one({"_id": ObjectId(coupon_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"message": "Coupon deleted"}

def calculate_deal_score(coupon: dict) -> float:
    """Calculate an AI-based deal score (0-100) considering multiple factors"""
    score = 0.0

    # 1. Discount depth (0-35 pts)
    dv = coupon.get("discount_value") or 0
    if coupon.get("discount_type") == "percentage":
        score += min(dv * 0.7, 35)  # 50% off = 35 pts
    elif coupon.get("discount_type") == "flat" and coupon.get("original_price"):
        pct = (dv / coupon["original_price"]) * 100
        score += min(pct * 0.7, 35)
    elif dv:
        score += min(dv / 50, 20)

    # 2. Price advantage (0-20 pts)
    op = coupon.get("original_price") or 0
    dp = coupon.get("discounted_price") or 0
    if op > 0 and dp > 0 and op > dp:
        savings_pct = ((op - dp) / op) * 100
        score += min(savings_pct * 0.4, 20)

    # 3. Popularity / trending (0-15 pts)
    clicks = coupon.get("clicks") or 0
    if clicks >= 100:
        score += 15
    elif clicks >= 50:
        score += 12
    elif clicks >= 20:
        score += 8
    elif clicks >= 5:
        score += 4

    # 4. Verification & trust (0-15 pts)
    if coupon.get("is_verified"):
        score += 10
    if coupon.get("code"):
        score += 5

    # 5. Freshness & featured (0-15 pts)
    if coupon.get("is_featured"):
        score += 10
    # Freshness: newer deals get bonus
    created = coupon.get("created_at")
    if created:
        try:
            if isinstance(created, datetime):
                if created.tzinfo is None:
                    from datetime import timezone as tz
                    created = created.replace(tzinfo=tz.utc)
                age_days = (datetime.now(timezone.utc) - created).days
            else:
                age_days = 30
        except Exception:
            age_days = 30
        if age_days <= 1:
            score += 5
        elif age_days <= 7:
            score += 3
        elif age_days <= 14:
            score += 1

    return round(min(score, 100), 1)


def get_verification_status(coupon: dict) -> str:
    """Determine coupon verification status based on expiry and flags"""
    if not coupon.get("is_verified", False):
        return "unverified"
    expires = coupon.get("expires_at")
    if expires:
        if isinstance(expires, str):
            try:
                expires = datetime.fromisoformat(expires.replace("Z", "+00:00"))
            except Exception:
                expires = None
        if expires and expires < datetime.now(timezone.utc):
            return "expired"
    return "verified"

# ===================== CLICK TRACKING =====================

@api_router.post("/clicks")
async def track_click(data: ClickCreate, request: Request):
    """Track coupon clicks for analytics"""
    # Increment click count
    await db.coupons.update_one(
        {"_id": ObjectId(data.coupon_id)},
        {"$inc": {"clicks": 1}}
    )
    
    # Log click for analytics
    click_doc = {
        "coupon_id": data.coupon_id,
        "source": data.source,
        "ip": request.client.host,
        "user_agent": request.headers.get("user-agent"),
        "created_at": datetime.now(timezone.utc)
    }
    await db.clicks.insert_one(click_doc)
    
    # Get coupon for redirect URL
    coupon = await db.coupons.find_one({"_id": ObjectId(data.coupon_id)})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return {"redirect_url": coupon["affiliate_url"], "clicks": coupon.get("clicks", 0) + 1}

# ===================== CSV UPLOAD =====================

@api_router.post("/coupons/bulk-upload")
async def bulk_upload_coupons(file: UploadFile = File(...), request: Request = None):
    if request:
        await get_admin_user(request)
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    coupons_added = 0
    errors = []
    
    for idx, row in enumerate(reader):
        try:
            coupon_doc = {
                "title": row.get("title", "").strip(),
                "description": row.get("description", "").strip(),
                "code": row.get("code", "").strip() or None,
                "discount_type": row.get("discount_type", "percentage").strip(),
                "discount_value": float(row.get("discount_value", 0)) if row.get("discount_value") else None,
                "brand_name": row.get("brand_name", "").strip(),
                "category_name": row.get("category_name", "").strip(),
                "original_price": float(row.get("original_price", 0)) if row.get("original_price") else None,
                "discounted_price": float(row.get("discounted_price", 0)) if row.get("discounted_price") else None,
                "affiliate_url": row.get("affiliate_url", "").strip(),
                "image_url": row.get("image_url", "").strip() or None,
                "is_featured": row.get("is_featured", "").lower() == "true",
                "is_verified": row.get("is_verified", "true").lower() == "true",
                "is_active": True,
                "clicks": 0,
                "tags": [t.strip() for t in row.get("tags", "").split(",") if t.strip()],
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            
            if not coupon_doc["title"] or not coupon_doc["affiliate_url"]:
                errors.append(f"Row {idx + 1}: Missing required fields (title or affiliate_url)")
                continue
            
            coupon_doc["deal_score"] = calculate_deal_score(coupon_doc)
            await db.coupons.insert_one(coupon_doc)
            coupons_added += 1
            
        except Exception as e:
            errors.append(f"Row {idx + 1}: {str(e)}")
    
    return {
        "message": f"Successfully added {coupons_added} coupons",
        "added": coupons_added,
        "errors": errors
    }

# ===================== AI CONTENT GENERATION =====================

@api_router.post("/ai/generate-content", response_model=AIContentResponse)
async def generate_ai_content(data: AIContentRequest, request: Request):
    """Generate AI-powered marketing content for deals"""
    await get_admin_user(request)
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"content-gen-{uuid.uuid4()}",
            system_message="You are a marketing expert for a coupon/deals website. Generate catchy, conversion-focused content."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Generate marketing content for this deal:
Product: {data.product_name}
Brand: {data.brand}
Discount: {data.discount}
Category: {data.category}

Provide the response in this exact JSON format:
{{
    "title": "A catchy deal title (max 60 chars)",
    "description": "A compelling description (max 150 chars)",
    "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
    "whatsapp_message": "A WhatsApp-ready message with emojis (max 200 chars)",
    "telegram_post": "A Telegram post with formatting (max 300 chars)"
}}

Make it urgent, exciting, and conversion-focused. Use emojis appropriately."""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        import json
        # Parse JSON from response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        content = json.loads(response_text)
        return AIContentResponse(**content)
        
    except Exception as e:
        logger.error(f"AI content generation failed: {e}")
        # Fallback to template-based generation
        return AIContentResponse(
            title=f"{data.discount} OFF on {data.product_name}",
            description=f"Save big on {data.product_name} from {data.brand}. Limited time offer!",
            hashtags=[data.brand.lower().replace(" ", ""), data.category.lower().replace(" ", ""), "deals", "savings"],
            whatsapp_message=f"🔥 {data.discount} OFF on {data.product_name}\nLimited time deal 👇\n[link]",
            telegram_post=f"🎉 *{data.discount} OFF*\n\n{data.product_name} from {data.brand}\n\n⏰ Limited Time Only\n🛒 Shop Now!"
        )

# ===================== ANALYTICS =====================

@api_router.get("/analytics/overview")
async def get_analytics_overview(request: Request):
    await get_admin_user(request)
    
    total_coupons = await db.coupons.count_documents({})
    active_coupons = await db.coupons.count_documents({"is_active": True})
    total_clicks = await db.clicks.count_documents({})
    total_users = await db.users.count_documents({})
    total_pretty_links = await db.pretty_links.count_documents({})
    total_pages = await db.pages.count_documents({})
    total_blog_posts = await db.blog_posts.count_documents({})
    
    # Top brands by clicks
    top_brands_pipeline = [
        {"$group": {"_id": "$brand_name", "total_clicks": {"$sum": "$clicks"}}},
        {"$sort": {"total_clicks": -1}},
        {"$limit": 5}
    ]
    top_brands = await db.coupons.aggregate(top_brands_pipeline).to_list(5)
    
    # Recent clicks (last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_clicks = await db.clicks.count_documents({"created_at": {"$gte": week_ago}})
    
    # Top pretty links
    top_links = await db.pretty_links.find({}, {"_id": 0, "slug": 1, "clicks": 1, "title": 1}).sort("clicks", -1).limit(5).to_list(5)
    
    return {
        "total_coupons": total_coupons,
        "active_coupons": active_coupons,
        "total_clicks": total_clicks,
        "total_users": total_users,
        "total_pretty_links": total_pretty_links,
        "total_pages": total_pages,
        "total_blog_posts": total_blog_posts,
        "recent_clicks": recent_clicks,
        "top_brands": [{"name": b["_id"], "clicks": b["total_clicks"]} for b in top_brands],
        "top_links": top_links
    }

# ===================== PRETTY LINKS =====================

@api_router.get("/pretty-links", response_model=List[PrettyLinkResponse])
async def get_pretty_links(request: Request):
    await get_admin_user(request)
    links = await db.pretty_links.find({}).sort("created_at", -1).to_list(500)
    result = []
    for link in links:
        link["id"] = str(link["_id"])
        link["short_url"] = f"/go/{link['slug']}"
        del link["_id"]
        result.append(link)
    return result

@api_router.post("/pretty-links", response_model=PrettyLinkResponse)
async def create_pretty_link(data: PrettyLinkCreate, request: Request):
    await get_admin_user(request)
    
    # Check if slug exists
    existing = await db.pretty_links.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")
    
    doc = data.model_dump()
    doc["clicks"] = 0
    doc["created_at"] = datetime.now(timezone.utc)
    doc["last_clicked"] = None
    result = await db.pretty_links.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["short_url"] = f"/go/{doc['slug']}"
    return doc

@api_router.put("/pretty-links/{link_id}", response_model=PrettyLinkResponse)
async def update_pretty_link(link_id: str, data: PrettyLinkUpdate, request: Request):
    await get_admin_user(request)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.pretty_links.update_one({"_id": ObjectId(link_id)}, {"$set": update_data})
    link = await db.pretty_links.find_one({"_id": ObjectId(link_id)})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    link["id"] = str(link["_id"])
    link["short_url"] = f"/go/{link['slug']}"
    del link["_id"]
    return link

@api_router.delete("/pretty-links/{link_id}")
async def delete_pretty_link(link_id: str, request: Request):
    await get_admin_user(request)
    result = await db.pretty_links.delete_one({"_id": ObjectId(link_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"message": "Link deleted"}

@api_router.get("/pretty-links/analytics/{link_id}")
async def get_pretty_link_analytics(link_id: str, request: Request):
    await get_admin_user(request)
    link = await db.pretty_links.find_one({"_id": ObjectId(link_id)})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    # Get click history
    clicks = await db.link_clicks.find({"link_id": link_id}).sort("created_at", -1).limit(100).to_list(100)
    
    return {
        "link": {
            "id": str(link["_id"]),
            "slug": link["slug"],
            "destination_url": link["destination_url"],
            "total_clicks": link.get("clicks", 0)
        },
        "recent_clicks": [{"ip": c.get("ip", ""), "user_agent": c.get("user_agent", ""), "created_at": c["created_at"]} for c in clicks]
    }

# Public redirect endpoint (no auth required)
@api_router.get("/go/{slug}")
async def redirect_pretty_link(slug: str, request: Request):
    link = await db.pretty_links.find_one({"slug": slug, "is_active": True})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    # Track click
    await db.pretty_links.update_one(
        {"_id": link["_id"]},
        {"$inc": {"clicks": 1}, "$set": {"last_clicked": datetime.now(timezone.utc)}}
    )
    
    # Log click details
    await db.link_clicks.insert_one({
        "link_id": str(link["_id"]),
        "slug": slug,
        "ip": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", ""),
        "referer": request.headers.get("referer", ""),
        "created_at": datetime.now(timezone.utc)
    })
    
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=link["destination_url"], status_code=302)

# ===================== PAGES (CMS) =====================

@api_router.get("/pages")
async def get_pages(published_only: bool = False):
    query = {"is_published": True} if published_only else {}
    pages = await db.pages.find(query).sort("created_at", -1).to_list(100)
    result = []
    for page in pages:
        page["id"] = str(page["_id"])
        del page["_id"]
        result.append(page)
    return result

@api_router.get("/pages/{slug}")
async def get_page_by_slug(slug: str):
    page = await db.pages.find_one({"slug": slug})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page["id"] = str(page["_id"])
    del page["_id"]
    return page

@api_router.post("/pages", response_model=PageResponse)
async def create_page(data: PageCreate, request: Request):
    await get_admin_user(request)
    
    existing = await db.pages.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Page with this slug already exists")
    
    doc = data.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    doc["updated_at"] = datetime.now(timezone.utc)
    result = await db.pages.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

@api_router.put("/pages/{page_id}", response_model=PageResponse)
async def update_page(page_id: str, data: PageUpdate, request: Request):
    await get_admin_user(request)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.pages.update_one({"_id": ObjectId(page_id)}, {"$set": update_data})
    page = await db.pages.find_one({"_id": ObjectId(page_id)})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page["id"] = str(page["_id"])
    del page["_id"]
    return page

@api_router.delete("/pages/{page_id}")
async def delete_page(page_id: str, request: Request):
    await get_admin_user(request)
    result = await db.pages.delete_one({"_id": ObjectId(page_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"message": "Page deleted"}

# ===================== BLOG =====================

@api_router.get("/blog")
async def get_blog_posts(published_only: bool = True, limit: int = 20, skip: int = 0):
    query = {"is_published": True} if published_only else {}
    posts = await db.blog_posts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    result = []
    for post in posts:
        post["id"] = str(post["_id"])
        del post["_id"]
        result.append(post)
    return result

@api_router.get("/blog/{slug}")
async def get_blog_post(slug: str):
    post = await db.blog_posts.find_one({"slug": slug})
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    
    # Increment views
    await db.blog_posts.update_one({"_id": post["_id"]}, {"$inc": {"views": 1}})
    
    post["id"] = str(post["_id"])
    post["views"] = post.get("views", 0) + 1
    del post["_id"]
    return post

@api_router.post("/blog", response_model=BlogPostResponse)
async def create_blog_post(data: BlogPostCreate, request: Request):
    await get_admin_user(request)
    
    existing = await db.blog_posts.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Blog post with this slug already exists")
    
    doc = data.model_dump()
    doc["views"] = 0
    doc["created_at"] = datetime.now(timezone.utc)
    doc["updated_at"] = datetime.now(timezone.utc)
    result = await db.blog_posts.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

@api_router.put("/blog/{post_id}", response_model=BlogPostResponse)
async def update_blog_post(post_id: str, data: BlogPostUpdate, request: Request):
    await get_admin_user(request)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.blog_posts.update_one({"_id": ObjectId(post_id)}, {"$set": update_data})
    post = await db.blog_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    post["id"] = str(post["_id"])
    del post["_id"]
    return post

@api_router.delete("/blog/{post_id}")
async def delete_blog_post(post_id: str, request: Request):
    await get_admin_user(request)
    result = await db.blog_posts.delete_one({"_id": ObjectId(post_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return {"message": "Blog post deleted"}

@api_router.get("/analytics/clicks")
async def get_click_analytics(request: Request, days: int = 7):
    await get_admin_user(request)
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_clicks = await db.clicks.aggregate(pipeline).to_list(days)
    return {"daily_clicks": [{"date": d["_id"], "clicks": d["count"]} for d in daily_clicks]}

# ===================== SEO PAGES DATA =====================

@api_router.get("/seo/{page_type}")
async def get_seo_page_data(page_type: str):
    """Get data for SEO pages like /amazon-coupons, /myntra-sale-today"""
    
    # Parse page type
    parts = page_type.lower().replace("-", " ").split()
    
    query = {"is_active": True}
    title = "Best Deals & Coupons"
    description = "Find the best deals and coupons"
    
    # Check for brand-specific pages
    brand_keywords = ["amazon", "myntra", "flipkart", "ajio", "nykaa", "swiggy", "zomato"]
    for brand in brand_keywords:
        if brand in parts:
            query["brand_name"] = {"$regex": brand, "$options": "i"}
            title = f"{brand.title()} Coupons & Deals"
            description = f"Latest {brand.title()} coupons, promo codes, and deals"
            break
    
    # Check for category-specific pages
    if "electronics" in parts:
        query["category_name"] = {"$regex": "electronics", "$options": "i"}
    elif "fashion" in parts:
        query["category_name"] = {"$regex": "fashion", "$options": "i"}
    elif "food" in parts:
        query["category_name"] = {"$regex": "food", "$options": "i"}
    
    # Check for price-based pages
    if "under" in parts:
        try:
            idx = parts.index("under")
            price = int(parts[idx + 1])
            query["discounted_price"] = {"$lte": price}
            title = f"Best Deals Under ₹{price}"
        except:
            pass
    
    coupons = await db.coupons.find(query, {"_id": 0, "id": {"$toString": "$_id"}, "title": 1, "description": 1, "code": 1, "discount_type": 1, "discount_value": 1, "brand_name": 1, "category_name": 1, "affiliate_url": 1, "image_url": 1, "is_verified": 1}).sort("deal_score", -1).limit(20).to_list(20)
    
    return {
        "title": title,
        "description": description,
        "meta_keywords": f"{page_type.replace('-', ', ')}, coupons, deals, discounts, promo codes",
        "coupons": coupons,
        "faq": [
            {"q": f"How to use {title}?", "a": "Simply click on the deal, copy the code if available, and apply at checkout."},
            {"q": "Are these coupons verified?", "a": "Yes, our team verifies all coupons regularly."},
            {"q": "How often are deals updated?", "a": "We update deals multiple times daily to ensure freshness."}
        ]
    }

# ===================== HEALTH & ROOT =====================

@api_router.get("/")
async def root():
    return {"message": "DISCCART API v1.0", "status": "healthy"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ===================== SEO ENDPOINTS =====================

SITE_URL = os.environ.get("SITE_URL", "https://disccart.in")

@app.get("/robots.txt", response_class=Response)
async def robots_txt():
    """Generate robots.txt for search engine crawlers"""
    content = f"""# DISCCART Robots.txt
# https://disccart.in

User-agent: *
Allow: /
Allow: /categories
Allow: /trending
Allow: /category/*
Allow: /deals/*
Allow: /search

# Disallow admin and auth pages
Disallow: /admin
Disallow: /login
Disallow: /register
Disallow: /profile
Disallow: /api/

# Sitemap location
Sitemap: {SITE_URL}/sitemap.xml

# Crawl-delay for polite crawling
Crawl-delay: 1
"""
    return Response(content=content, media_type="text/plain")

@app.get("/sitemap.xml", response_class=Response)
async def sitemap_xml():
    """Generate dynamic XML sitemap"""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Static pages
    static_pages = [
        {"loc": "/", "priority": "1.0", "changefreq": "daily"},
        {"loc": "/categories", "priority": "0.9", "changefreq": "daily"},
        {"loc": "/trending", "priority": "0.9", "changefreq": "hourly"},
    ]
    
    # Get categories for dynamic pages
    categories = await db.categories.find({}, {"slug": 1}).to_list(100)
    
    # Get brands for SEO pages
    brands = ["amazon", "flipkart", "myntra", "swiggy", "zomato", "nykaa", "ajio", "makemytrip"]
    
    # SEO keyword pages
    seo_pages = [
        "amazon-coupons", "myntra-sale-today", "flipkart-offers", 
        "swiggy-coupons", "zomato-coupons", "electronics-deals",
        "fashion-sale", "best-deals-under-1000", "food-delivery-coupons"
    ]
    
    # Build XML
    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
    xml_content += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
    
    # Add static pages
    for page in static_pages:
        xml_content += f"""  <url>
    <loc>{SITE_URL}{page["loc"]}</loc>
    <lastmod>{now}</lastmod>
    <changefreq>{page["changefreq"]}</changefreq>
    <priority>{page["priority"]}</priority>
  </url>\n"""
    
    # Add category pages
    for cat in categories:
        xml_content += f"""  <url>
    <loc>{SITE_URL}/category/{cat["slug"]}</loc>
    <lastmod>{now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>\n"""
    
    # Add SEO pages
    for seo_page in seo_pages:
        xml_content += f"""  <url>
    <loc>{SITE_URL}/deals/{seo_page}</loc>
    <lastmod>{now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>\n"""
    
    xml_content += '</urlset>'
    
    return Response(content=xml_content, media_type="application/xml")

@api_router.get("/seo/meta/{page_type}")
async def get_seo_meta(page_type: str):
    """Get SEO meta data for different page types"""
    
    base_meta = {
        "site_name": "DISCCART",
        "locale": "en_IN",
        "type": "website",
        "twitter_card": "summary_large_image",
        "twitter_site": "@disccart"
    }
    
    meta_data = {
        "home": {
            "title": "DISCCART - Best Deals, Coupons & Promo Codes India 2026",
            "description": "Find verified coupons, promo codes & exclusive deals from Amazon, Flipkart, Myntra & 500+ brands. Save up to 90% on your online shopping!",
            "keywords": "coupons, promo codes, deals, discounts, offers, amazon coupons, flipkart offers, myntra sale, online shopping deals india",
            "image": f"{SITE_URL}/og-image.png"
        },
        "categories": {
            "title": "All Categories - Coupons & Deals | DISCCART",
            "description": "Browse deals by category - Electronics, Fashion, Food, Travel, Beauty & more. Find the best coupons for every shopping need.",
            "keywords": "shopping categories, electronics deals, fashion coupons, food delivery offers, travel discounts",
            "image": f"{SITE_URL}/og-categories.png"
        },
        "trending": {
            "title": "Trending Deals & Hot Offers Today | DISCCART",
            "description": "Discover today's hottest deals and trending offers. Limited time discounts on top brands updated every hour.",
            "keywords": "trending deals, hot offers, today deals, limited time offers, flash sale",
            "image": f"{SITE_URL}/og-trending.png"
        }
    }
    
    # Dynamic brand pages
    if page_type.startswith("brand-"):
        brand = page_type.replace("brand-", "").replace("-", " ").title()
        meta_data[page_type] = {
            "title": f"{brand} Coupons, Promo Codes & Offers - January 2026 | DISCCART",
            "description": f"Get the latest {brand} coupons, promo codes & exclusive deals. Save up to 80% with verified {brand} offers.",
            "keywords": f"{brand.lower()} coupons, {brand.lower()} promo codes, {brand.lower()} offers, {brand.lower()} deals",
            "image": f"{SITE_URL}/og-{page_type}.png"
        }
    
    # Dynamic category pages
    if page_type.startswith("category-"):
        category = page_type.replace("category-", "").replace("-", " ").title()
        meta_data[page_type] = {
            "title": f"{category} Deals & Coupons - Best Offers | DISCCART",
            "description": f"Find the best {category.lower()} deals, coupons & discounts. Save big on {category.lower()} shopping with verified promo codes.",
            "keywords": f"{category.lower()} deals, {category.lower()} coupons, {category.lower()} offers, {category.lower()} discounts",
            "image": f"{SITE_URL}/og-{page_type}.png"
        }
    
    result = meta_data.get(page_type, meta_data["home"])
    result.update(base_meta)
    return result

# Include the router
app.include_router(api_router)

# Add GZip compression
app.add_middleware(GZipMiddleware, minimum_size=500)

# Add security headers
app.add_middleware(SecurityHeadersMiddleware)

# Add rate limiting
app.add_middleware(RateLimitMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app = FastAPI()
app.add_middleware(RateLimitMiddleware)
api_router = APIRouter()

# ===================== UTILITY FUNCTIONS =====================

def hash_password(password: str) -> str:
    import bcrypt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    import bcrypt
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


# ===================== BACKGROUND FUNCTIONS =====================

async def recalculate_deal_scores():
    """Recalculate all deal scores with the enhanced algorithm"""
    async for coupon in db.coupons.find({}):
        new_score = calculate_deal_score(coupon)
        if coupon.get("deal_score") != new_score:
            await db.coupons.update_one(
                {"_id": coupon["_id"]},
                {"$set": {"deal_score": new_score}}
            )


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "disccartindia@gmail.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@2026@")

    # Remove old admins (if email changed)
    await db.users.delete_many({
        "role": "admin",
        "email": {"$ne": admin_email}
    })

    existing = await db.users.find_one({"email": admin_email})

    if existing is None:
        hashed = hash_password(admin_password)

        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "DISCCART Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })

        logger.info(f"✅ Admin created: {admin_email}")

    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )

        logger.info("🔄 Admin password updated")


# ===================== STARTUP =====================

@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.coupons.create_index([("brand_name", 1), ("is_active", 1)])
    await db.coupons.create_index([("category_name", 1), ("is_active", 1)])
    await db.coupons.create_index("deal_score")
    await db.clicks.create_index("created_at")

    # Seed admin
    await seed_admin()

    # Seed initial data
    await seed_initial_data()

    # Recalculate deal scores
    await recalculate_deal_scores()

    logger.info("🚀 DISCCART API started successfully")
    
    # Write credentials
import os
from pathlib import Path

# ✅ Define values properly
admin_email = "disccartindia@gmail.com"
admin_password = "admin@2026@"

# Create memory directory in correct runtime path
BASE_DIR = Path(os.getcwd())
MEMORY_DIR = BASE_DIR / "memory"
MEMORY_DIR.mkdir(parents=True, exist_ok=True)

# Write file inside memory folder
file_path = MEMORY_DIR / "test_credentials.md"

with open(file_path, "w") as f:
    f.write("# Test Credentials\n\n")
    f.write("## Admin Account\n")
    f.write("- Email: " + admin_email + "\n")
    f.write("- Password: " + admin_password + "\n")
    f.write("- Role: admin\n\n")
    f.write("## Auth Endpoints\n")
    f.write("- POST /api/auth/register\n")
    f.write("- POST /api/auth/login\n")
    f.write("- POST /api/auth/logout\n")
    f.write("- GET /api/auth/me\n")

async def seed_initial_data():
    """Seed initial categories and sample coupons"""
    
    # Seed pages/blogs/links independently (they have their own guards)
    await seed_static_pages()
    await seed_blog_posts()
    await seed_pretty_links()
    
    # Check if categories/coupons already exist
    if await db.categories.count_documents({}) > 0:
        return
    
    # Seed categories
    categories = [
        {"name": "Electronics", "slug": "electronics", "icon": "Laptop", "image_url": "https://images.unsplash.com/photo-1595284842888-519573d8fb7b?w=400", "description": "Gadgets, mobiles, laptops & more"},
        {"name": "Fashion", "slug": "fashion", "icon": "Shirt", "image_url": "https://images.pexels.com/photos/7679655/pexels-photo-7679655.jpeg?w=400", "description": "Clothing, footwear & accessories"},
        {"name": "Food & Dining", "slug": "food", "icon": "UtensilsCrossed", "image_url": "https://images.pexels.com/photos/4440858/pexels-photo-4440858.jpeg?w=400", "description": "Restaurants, groceries & food delivery"},
        {"name": "Travel", "slug": "travel", "icon": "Plane", "image_url": "https://images.pexels.com/photos/8216324/pexels-photo-8216324.jpeg?w=400", "description": "Flights, hotels & vacation packages"},
        {"name": "Beauty", "slug": "beauty", "icon": "Sparkles", "image_url": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400", "description": "Makeup, skincare & personal care"},
        {"name": "Home & Living", "slug": "home", "icon": "Home", "image_url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400", "description": "Furniture, decor & appliances"}
    ]
    
    for cat in categories:
        cat["created_at"] = datetime.now(timezone.utc)
    await db.categories.insert_many(categories)
    
    # Seed sample coupons
    sample_coupons = [
        {
            "title": "70% OFF on Sneakers",
            "description": "Get amazing discounts on branded sneakers. Limited time offer!",
            "code": "SNEAK70",
            "discount_type": "percentage",
            "discount_value": 70,
            "brand_name": "Amazon",
            "category_name": "Fashion",
            "original_price": 4999,
            "discounted_price": 1499,
            "affiliate_url": "https://amazon.in/sneakers?tag=disccart",
            "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
            "is_featured": True,
            "is_verified": True,
            "tags": ["sneakers", "shoes", "fashion"]
        },
        {
            "title": "Flat ₹500 OFF on Electronics",
            "description": "Use this code to save on any electronics purchase above ₹2999",
            "code": "ELEC500",
            "discount_type": "flat",
            "discount_value": 500,
            "brand_name": "Flipkart",
            "category_name": "Electronics",
            "affiliate_url": "https://flipkart.com/electronics?affid=disccart",
            "image_url": "https://images.unsplash.com/photo-1593640495253-23196b27a87f?w=400",
            "is_featured": True,
            "is_verified": True,
            "tags": ["electronics", "gadgets", "tech"]
        },
        {
            "title": "50% OFF on First Food Order",
            "description": "New users get 50% discount on their first order. Max discount ₹150",
            "code": "NEWFOOD50",
            "discount_type": "percentage",
            "discount_value": 50,
            "brand_name": "Swiggy",
            "category_name": "Food & Dining",
            "affiliate_url": "https://swiggy.com?ref=disccart",
            "image_url": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400",
            "is_featured": False,
            "is_verified": True,
            "tags": ["food", "delivery", "swiggy"]
        },
        {
            "title": "Extra 20% OFF on Myntra",
            "description": "Additional 20% off on already discounted items. Use code at checkout.",
            "code": "MYNTRA20",
            "discount_type": "percentage",
            "discount_value": 20,
            "brand_name": "Myntra",
            "category_name": "Fashion",
            "affiliate_url": "https://myntra.com?utm_source=disccart",
            "image_url": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400",
            "is_featured": True,
            "is_verified": True,
            "tags": ["myntra", "fashion", "clothing"]
        },
        {
            "title": "₹2000 OFF on Flight Bookings",
            "description": "Book domestic flights and save ₹2000 on bookings above ₹5000",
            "code": "FLY2000",
            "discount_type": "flat",
            "discount_value": 2000,
            "brand_name": "MakeMyTrip",
            "category_name": "Travel",
            "affiliate_url": "https://makemytrip.com/flights?ref=disccart",
            "image_url": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400",
            "is_featured": False,
            "is_verified": True,
            "tags": ["flights", "travel", "booking"]
        },
        {
            "title": "Buy 1 Get 1 FREE on Beauty Products",
            "description": "Amazing BOGO offer on all beauty and skincare products",
            "code": None,
            "discount_type": "deal",
            "discount_value": 50,
            "brand_name": "Nykaa",
            "category_name": "Beauty",
            "affiliate_url": "https://nykaa.com/sale?ref=disccart",
            "image_url": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400",
            "is_featured": True,
            "is_verified": True,
            "tags": ["beauty", "skincare", "nykaa"]
        }
    ]
    
    for coupon in sample_coupons:
        coupon["is_active"] = True
        coupon["clicks"] = 0
        coupon["created_at"] = datetime.now(timezone.utc)
        coupon["updated_at"] = datetime.now(timezone.utc)
        coupon["deal_score"] = calculate_deal_score(coupon)
    
    await db.coupons.insert_many(sample_coupons)
    logger.info("Initial coupons seeded")
    
    logger.info("Initial data seeded")

async def seed_static_pages():
    """Seed static pages like Privacy Policy, Terms, About, Contact"""
    if await db.pages.count_documents({}) > 0:
        return
    
    pages = [
        {
            "slug": "privacy-policy",
            "title": "Privacy Policy",
            "meta_description": "DISCCART Privacy Policy - Learn how we collect, use, and protect your personal information when you use our coupon and deals platform.",
            "meta_keywords": "privacy policy, data protection, user privacy, disccart privacy",
            "content": """
# Privacy Policy

**Last Updated: March 2026**

Welcome to DISCCART. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website.

## Information We Collect

### Personal Information
When you use DISCCART, we may collect the following information:
- **Account Information**: Name, email address, and password when you create an account
- **Usage Data**: Pages visited, deals clicked, coupons copied, and time spent on our platform
- **Device Information**: Browser type, IP address, device type, and operating system

### Automatically Collected Information
- Cookies and similar tracking technologies
- Analytics data through Google Analytics
- Interaction data with our deals and coupons

## How We Use Your Information

We use the collected information for:
- Providing personalized deal recommendations
- Improving our services and user experience
- Sending newsletters and promotional content (with your consent)
- Analyzing website traffic and user behavior
- Preventing fraud and ensuring security

## Third-Party Services

DISCCART works with various affiliate partners and third-party services:
- **Affiliate Networks**: We earn commissions when you make purchases through our affiliate links
- **Analytics**: Google Analytics to understand user behavior
- **Advertising**: Facebook Pixel for targeted advertising

## Your Rights

You have the right to:
- Access your personal data
- Request correction of inaccurate data
- Request deletion of your data
- Opt-out of marketing communications
- Withdraw consent at any time

## Data Security

We implement appropriate security measures to protect your personal information, including:
- SSL encryption for data transmission
- Secure password hashing
- Regular security audits

## Contact Us

For any privacy-related questions, contact us at:
- **Email**: disccartindia@gmail.com
- **Phone**: +91 9111036751

## Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
""",
            "is_published": True
        },
        {
            "slug": "terms-and-conditions",
            "title": "Terms & Conditions",
            "meta_description": "DISCCART Terms and Conditions - Read our terms of service, user responsibilities, and guidelines for using our coupon platform.",
            "meta_keywords": "terms and conditions, terms of service, user agreement, disccart terms",
            "content": """
# Terms & Conditions

**Effective Date: March 2026**

Welcome to DISCCART. By accessing and using our website, you agree to be bound by these Terms and Conditions.

## 1. Acceptance of Terms

By using DISCCART, you acknowledge that you have read, understood, and agree to be bound by these terms. If you do not agree, please do not use our services.

## 2. Description of Service

DISCCART is an online platform that provides:
- Coupon codes and promo codes from various online retailers
- Deal alerts and discount notifications
- Affiliate links to partner merchants
- Saving tips and shopping guides

## 3. User Responsibilities

As a user of DISCCART, you agree to:
- Provide accurate information when creating an account
- Use the platform for personal, non-commercial purposes only
- Not attempt to manipulate or abuse our affiliate system
- Not scrape, copy, or redistribute our content without permission
- Comply with all applicable laws and regulations

## 4. Coupon and Deal Accuracy

While we strive to provide accurate and up-to-date information:
- Coupons and deals are subject to change without notice
- We do not guarantee the validity of any coupon or deal
- Final terms are determined by the respective merchants
- Prices and discounts are verified at the time of posting

## 5. Affiliate Disclosure

DISCCART participates in affiliate marketing programs. This means:
- We earn commissions on qualifying purchases made through our links
- This does not affect the price you pay
- Our recommendations are based on value, not commission rates

## 6. Intellectual Property

All content on DISCCART, including:
- Text, graphics, logos, and images
- Software and code
- Deal descriptions and reviews

Is the property of DISCCART and protected by intellectual property laws.

## 7. Limitation of Liability

DISCCART shall not be liable for:
- Expired or invalid coupons
- Changes in merchant terms or prices
- Any losses arising from use of our platform
- Third-party website content or practices

## 8. Modifications

We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.

## 9. Contact Information

For questions about these Terms, contact us:
- **Email**: disccartindia@gmail.com
- **Phone**: +91 9111036751
""",
            "is_published": True
        },
        {
            "slug": "about-us",
            "title": "About Us",
            "meta_description": "Learn about DISCCART - India's trusted platform for finding the best online shopping deals, coupons, and promo codes from top brands.",
            "meta_keywords": "about disccart, coupon website india, deals platform, online shopping savings",
            "content": """
# About DISCCART

## Your Trusted Savings Partner

Welcome to **DISCCART** – India's smart destination for discovering the best online shopping deals, coupons, and promo codes. We're passionate about helping shoppers save money on every purchase.

## Our Mission

At DISCCART, our mission is simple: **Help every Indian shopper save money while shopping online.** We believe that everyone deserves access to the best deals, and no one should pay full price when discounts are available.

## What We Do

### Curated Deals
Our team constantly scouts the internet for the best deals from top brands like Amazon, Flipkart, Myntra, Swiggy, and hundreds more. We verify each coupon before posting to ensure you always get working codes.

### Real-Time Updates
Deals change fast, and so do we. Our platform is updated multiple times daily to bring you the freshest offers and remove expired coupons.

### Easy to Use
Finding savings shouldn't be complicated. Our clean, user-friendly interface makes it easy to:
- Browse deals by category
- Search for specific brands
- Copy codes with one click
- Get redirected to deals instantly

## Why Choose DISCCART?

- **Verified Coupons**: Every code is tested before publishing
- **100% Free**: No hidden fees or premium subscriptions
- **Wide Coverage**: Deals from 500+ brands across all categories
- **Daily Updates**: Fresh deals added every day
- **Mobile Friendly**: Save money on any device

## Our Values

### Transparency
We clearly disclose our affiliate relationships. When you use our links, we may earn a commission – but this never affects our recommendations or the price you pay.

### Quality Over Quantity
We focus on curating the best deals rather than listing everything. Quality and relevance matter more than numbers.

### User First
Every feature we build and every deal we post is designed with our users in mind. Your savings are our success.

## Connect With Us

We love hearing from our community! Follow us on social media for instant deal alerts and saving tips:

- **Instagram**: @disccart
- **Telegram**: t.me/disccart
- **WhatsApp**: Join our channel for daily deals

## Contact

Have questions or suggestions? We'd love to hear from you:
- **Email**: disccartindia@gmail.com
- **Phone**: +91 9111036751

---

*Thank you for choosing DISCCART. Happy Saving!*
""",
            "is_published": True
        },
        {
            "slug": "contact-us",
            "title": "Contact Us",
            "meta_description": "Contact DISCCART - Get in touch with us for support, partnership inquiries, or feedback about our coupon and deals platform.",
            "meta_keywords": "contact disccart, customer support, partnership, feedback",
            "content": """
# Contact Us

We're here to help! Whether you have questions, feedback, or partnership inquiries, we'd love to hear from you.

## Get In Touch

### Customer Support
Having trouble with a coupon or need assistance? Our support team is ready to help.

- **Email**: disccartindia@gmail.com
- **Phone**: +91 9111036751
- **Response Time**: Within 24 hours

### Business Inquiries

#### For Brands & Merchants
Want to feature your deals on DISCCART? We partner with brands of all sizes to promote exclusive offers to our engaged audience.

**Benefits of partnering with us:**
- Access to thousands of deal-seeking shoppers
- Increased brand visibility
- Performance-based affiliate marketing
- Custom promotional campaigns

#### For Advertisers
Reach our audience of smart shoppers through targeted advertising opportunities.

### Follow Us

Stay connected for instant deal alerts and saving tips:

- **Instagram**: [@disccart](https://www.instagram.com/disccart)
- **Telegram**: [t.me/disccart](https://t.me/disccart)
- **WhatsApp**: [Join our channel](https://whatsapp.com/channel/0029Vb6dtO41t90dZb1BnB3K)

## Feedback

Your feedback helps us improve! Let us know:
- Which deals you'd like to see more of
- Features you'd like us to add
- Any issues you've encountered

## Office Address

DISCCART
India

---

*We typically respond to all inquiries within 24 business hours.*
""",
            "is_published": True
        }
    ]
    
    for page in pages:
        page["created_at"] = datetime.now(timezone.utc)
        page["updated_at"] = datetime.now(timezone.utc)
    
    await db.pages.insert_many(pages)
    logger.info("Static pages seeded")

async def seed_blog_posts():
    """Seed initial blog posts"""
    if await db.blog_posts.count_documents({}) > 0:
        return
    
    posts = [
        {
            "slug": "how-to-save-money-online-shopping-india",
            "title": "How to Save Money While Shopping Online in India",
            "excerpt": "Discover proven strategies to save money on your online purchases. Learn about coupons, cashback, timing, and more.",
            "featured_image": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800",
            "category": "Saving Tips",
            "tags": ["saving tips", "online shopping", "coupons", "cashback"],
            "meta_description": "Complete guide to saving money while shopping online in India. Learn about coupons, cashback, best timing, and insider tips.",
            "content": """
# How to Save Money While Shopping Online in India

Online shopping has become extremely popular in India. Millions of people buy products daily from platforms like Amazon, Flipkart, and Myntra. While shopping online is convenient, many shoppers end up paying more than necessary.

## 1. Always Search for Coupons First

Before making any purchase, spend a few minutes searching for coupon codes. Sites like DISCCART curate verified coupons from hundreds of brands, saving you the hassle of searching everywhere.

**Pro Tip**: Check for bank-specific offers too. Many credit and debit cards offer additional discounts on specific platforms.

## 2. Use Cashback Apps

Cashback apps can help you earn money back on your purchases. Popular options in India include:
- Cashkaro
- GoPayz
- Amazon Pay

Stack cashback with coupons for maximum savings!

## 3. Time Your Purchases

The best time to shop online in India:
- **Festive Sales**: Diwali, Holi, Independence Day
- **End of Season**: January and July for fashion
- **Flash Sales**: Big Billion Days, Great Indian Festival
- **Weekends**: Many sites offer weekend-only deals

## 4. Compare Prices

Don't buy from the first site you visit. The same product can have different prices across platforms. Use price comparison tools or manually check multiple sites.

## 5. Sign Up for Newsletters

Yes, your inbox might get cluttered, but brand newsletters often contain:
- Early access to sales
- Exclusive coupon codes
- Flash sale notifications

Create a separate email for shopping newsletters to keep things organized.

## 6. Use Price Drop Alerts

Many browser extensions and apps can track prices and alert you when they drop. This is especially useful for big purchases like electronics.

## 7. Don't Ignore Cart Abandonment Emails

If you add items to cart and leave without buying, many sites send follow-up emails with additional discounts. This isn't a guaranteed strategy but works surprisingly often!

## Conclusion

Smart online shopping is all about patience and research. By following these tips and regularly checking DISCCART for the latest deals, you can save thousands of rupees on your purchases.

*Happy Saving!*
""",
            "is_published": True,
            "views": 0
        },
        {
            "slug": "best-electronics-deals-india",
            "title": "Best Electronics Deals in India (2026) – Latest Gadgets Discounts",
            "excerpt": "Find the best electronics deals in India. Save big on smartphones, laptops, headphones, and more with our curated list of verified offers.",
            "featured_image": "https://images.unsplash.com/photo-1593640495253-23196b27a87f?w=800",
            "category": "Deal Guides",
            "tags": ["electronics", "gadgets", "smartphones", "laptops", "deals"],
            "meta_description": "Discover the best electronics deals in India for 2026. Find discounts on smartphones, laptops, headphones, and more.",
            "content": """
# Best Electronics Deals in India

Electronics have become an essential part of everyday life. From smartphones and laptops to headphones and smartwatches, everyone is looking for the best deals before making a purchase.

## Top Electronics Categories with Great Deals

### Smartphones
The smartphone market in India is highly competitive, which means great deals for consumers:
- **Budget Phones**: Realme, Redmi, Samsung M-series
- **Mid-Range**: OnePlus Nord, Samsung A-series, iPhone SE
- **Flagship**: iPhone 15, Samsung S24, OnePlus 12

**Best Time to Buy**: New model launches, festive sales

### Laptops
Whether for work, gaming, or study:
- **Student Laptops**: HP, Lenovo, Acer (₹30,000 - ₹50,000)
- **Professional**: Dell, MacBook, ThinkPad
- **Gaming**: ASUS ROG, MSI, Acer Predator

### Audio
Headphones and speakers see frequent discounts:
- **TWS Earbuds**: Sony, Jabra, Samsung, boAt
- **Over-ear**: Sony WH-1000XM5, Bose QC
- **Speakers**: JBL, Marshall, Sony

## Where to Find the Best Electronics Deals

1. **Amazon India**: Great for variety and quick delivery
2. **Flipkart**: Often has exclusive phone launches
3. **Croma & Reliance Digital**: Good for large appliances
4. **Brand Websites**: Sometimes have exclusive offers

## Tips for Buying Electronics Online

1. **Check Reviews**: Always read user reviews before buying
2. **Compare Specs**: Don't just look at the price
3. **Warranty**: Ensure you're getting official warranty
4. **Use Coupons**: Check DISCCART for the latest codes
5. **Bank Offers**: Credit card EMI and instant discounts

## Current Top Deals

Visit our [Electronics Deals](/category/electronics) page for the latest verified offers updated daily.

---

*Bookmark this page and check back regularly for updated deals!*
""",
            "is_published": True,
            "views": 0
        },
        {
            "slug": "coupon-codes-guide-beginners",
            "title": "The Ultimate Guide to Using Coupon Codes Online",
            "excerpt": "New to online coupons? Learn everything about finding, using, and maximizing coupon codes for your online shopping.",
            "featured_image": "https://images.unsplash.com/photo-1556742077-0a6b6a4a4ac4?w=800",
            "category": "Coupon Guides",
            "tags": ["coupons", "promo codes", "beginner guide", "how to"],
            "meta_description": "Complete beginner's guide to using coupon codes online. Learn how to find, apply, and maximize savings with promo codes.",
            "content": """
# The Ultimate Guide to Using Coupon Codes Online

If you're new to the world of online coupons and promo codes, this guide will help you understand everything you need to know to start saving money.

## What Are Coupon Codes?

Coupon codes (also called promo codes, discount codes, or voucher codes) are alphanumeric strings that you enter during checkout to receive discounts. They can offer:
- Percentage discounts (e.g., 20% OFF)
- Flat discounts (e.g., ₹500 OFF)
- Free shipping
- Free gifts with purchase
- Buy-one-get-one offers

## Types of Coupon Codes

### 1. Site-Wide Codes
Apply to your entire order. Example: "SAVE20" for 20% off everything.

### 2. Product-Specific Codes
Only work on certain products or categories.

### 3. First-Order Codes
Exclusive discounts for new customers.

### 4. Minimum Purchase Codes
Require a minimum order value. Example: "₹200 off on orders above ₹999"

### 5. Bank/Card Codes
Special discounts when using specific payment methods.

## How to Use Coupon Codes

1. **Find a Code**: Visit DISCCART and browse deals
2. **Copy the Code**: Click the "Copy" button
3. **Add Items to Cart**: Shop on the retailer's website
4. **Proceed to Checkout**: Go to the payment page
5. **Apply Code**: Look for "Have a promo code?" or similar
6. **Enter & Apply**: Paste your code and click Apply
7. **Verify Discount**: Ensure the discount is reflected

## Common Problems and Solutions

### Code Not Working?
- Check expiration date
- Verify minimum purchase requirements
- Ensure products are eligible
- Check if it's a first-time user code
- Look for typos

### Multiple Codes?
Most sites allow only one code per order. Choose the one that gives maximum savings.

## Pro Tips for Maximum Savings

1. **Stack with Sales**: Use codes during sales for extra savings
2. **Sign Up for Alerts**: Follow DISCCART on social media
3. **Check Before Buying**: Always search for codes before checkout
4. **Use Browser Extensions**: Some tools auto-find codes

## Where to Find Reliable Codes

- **DISCCART**: Verified, updated daily
- **Brand Newsletters**: Sign up for exclusive codes
- **Social Media**: Follow brands for flash deals

---

*Start your saving journey today at DISCCART!*
""",
            "is_published": True,
            "views": 0
        }
    ]
    
    for post in posts:
        post["created_at"] = datetime.now(timezone.utc)
        post["updated_at"] = datetime.now(timezone.utc)
    
    await db.blog_posts.insert_many(posts)
    logger.info("Blog posts seeded")

async def seed_pretty_links():
    """Seed sample pretty links"""
    if await db.pretty_links.count_documents({}) > 0:
        return
    
    links = [
        {
            "slug": "amazon-deals",
            "destination_url": "https://www.amazon.in?tag=disccart",
            "title": "Amazon India Deals",
            "description": "Shop the best deals on Amazon India",
            "is_active": True,
            "clicks": 0
        },
        {
            "slug": "flipkart-offers",
            "destination_url": "https://www.flipkart.com?affid=disccart",
            "title": "Flipkart Offers",
            "description": "Explore exclusive Flipkart offers",
            "is_active": True,
            "clicks": 0
        },
        {
            "slug": "myntra-sale",
            "destination_url": "https://www.myntra.com?utm_source=disccart",
            "title": "Myntra Fashion Sale",
            "description": "Latest fashion deals on Myntra",
            "is_active": True,
            "clicks": 0
        }
    ]
    
    for link in links:
        link["created_at"] = datetime.now(timezone.utc)
        link["last_clicked"] = None
    
    await db.pretty_links.insert_many(links)
    logger.info("Pretty links seeded")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

    app.include_router(api_router, prefix="/api")
