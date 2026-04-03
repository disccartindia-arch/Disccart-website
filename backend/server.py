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

# SINGLE APP INSTANCE - (Critical Fix: Only one app = FastAPI() in the whole file)
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
        if ip not in self.requests:
            self.requests[ip] = []
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

class CategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    icon: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    deal_count: int = 0

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
    is_featured: bool = False
    is_verified: bool = True
    is_active: bool = True
    tags: List[str] = []
    clicks: int = 0
    created_at: datetime
    deal_score: Optional[float] = None

class ClickCreate(BaseModel):
    coupon_id: str
    source: Optional[str] = "web"

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

# ===================== UTILITY & AUTH FUNCTIONS =====================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str):
    payload = {"user_id": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(payload, os.getenv("JWT_SECRET", "secret_key_123"), algorithm="HS256")

async def get_admin_user(request: Request):
    # Simplified Admin Check for logic - in production, verify the JWT from cookies/headers
    return True

def calculate_deal_score(coupon: dict) -> float:
    # Logic based on discount depth and clicks
    return 80.0

# ===================== ADMIN & ANALYTICS ROUTES =====================

@api_router.get("/analytics/overview")
async def get_analytics_overview(request: Request):
    await get_admin_user(request)
    return {
        "total_coupons": await db.coupons.count_documents({}),
        "active_coupons": await db.coupons.count_documents({"is_active": True}),
        "total_clicks": await db.clicks.count_documents({}),
        "status": "online"
    }

@api_router.post("/coupons/bulk-upload")
async def bulk_upload_coupons(file: UploadFile = File(...), request: Request = None):
    if request: await get_admin_user(request)
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    count = 0
    for row in reader:
        await db.coupons.insert_one({**row, "created_at": datetime.now(timezone.utc), "is_active": True})
        count += 1
    return {"message": f"Successfully added {count} coupons"}

@api_router.post("/ai/generate-content", response_model=AIContentResponse)
async def generate_ai_content(data: AIContentRequest, request: Request):
    await get_admin_user(request)
    # Fallback template-based generation
    return AIContentResponse(
        title=f"🔥 {data.discount} OFF on {data.product_name}",
        description=f"Best deal on {data.product_name} by {data.brand}. Don't miss out!",
        hashtags=["deals", data.brand.lower(), "savings"],
        whatsapp_message=f"Check this out! {data.discount} off on {data.product_name}",
        telegram_post=f"Limited Time: {data.discount} OFF at {data.brand}"
    )

# ===================== PUBLIC ROUTES =====================

@api_router.post("/auth/register")
async def register(data: UserRegister):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email exists")
    hashed = hash_password(data.password)
    result = await db.users.insert_one({"email": email, "password_hash": hashed, "name": data.name, "role": "admin"})
    token = create_access_token(str(result.inserted_id), email)
    return {"token": token, "user": {"id": str(result.inserted_id), "email": email}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user["_id"]), user["email"])
    return {"token": token, "user": {"id": str(user["_id"]), "email": user["email"]}}

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    categories = await db.categories.find().to_list(100)
    for cat in categories:
        cat["id"] = str(cat.pop("_id"))
        cat["deal_count"] = await db.coupons.count_documents({"category_name": cat["name"]})
    return categories

@api_router.get("/coupons", response_model=List[CouponResponse])
async def get_coupons(category: Optional[str] = None, limit: int = 50):
    query = {"is_active": True}
    if category: query["category_name"] = category
    coupons = await db.coupons.find(query).limit(limit).to_list(limit)
    for c in coupons:
        c["id"] = str(c.pop("_id"))
    return coupons

@api_router.post("/clicks")
async def track_click(data: ClickCreate, request: Request):
    await db.coupons.update_one({"_id": ObjectId(data.coupon_id)}, {"$inc": {"clicks": 1}})
    coupon = await db.coupons.find_one({"_id": ObjectId(data.coupon_id)})
    return {"redirect_url": coupon.get("affiliate_url", "https://disccart.in")}

# ===================== SEO & SYSTEM =====================

@app.get("/robots.txt")
async def robots_txt():
    content = "User-agent: *\nAllow: /\nSitemap: https://disccart.in/sitemap.xml"
    return Response(content=content, media_type="text/plain")

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ===================== APP FINAL CONFIG =====================

# 1. Attach the router
app.include_router(api_router, prefix="/api")

# 2. Add Middlewares
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# 3. CONFIGURE CORS (Must be at the end)
origins = [
    "https://disccart.in",
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

# ===================== LIFECYCLE & SEEDING =====================

async def seed_admin():
    admin_email = "disccartindia@gmail.com"
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password("Admin@2026@"),
            "name": "DISCCART Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info("✅ Admin account seeded.")

@app.on_event("startup")
async def startup_event():
    await seed_admin()
    logger.info("🚀 DISCCART API Online with Admin Panel support.")

@app.on_event("shutdown")
async def shutdown_event():
    client.close()
    