from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt
import secrets
import csv
import io

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

# Password hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT Token Management
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Auth helper
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# Create the main app
app = FastAPI(title="DISCCART API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

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
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
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
        # Increment failed attempts
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {
                "$inc": {"count": 1},
                "$set": {"lockout_until": datetime.now(timezone.utc) + timedelta(minutes=15)}
            },
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Clear failed attempts on success
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"_id": user_id, "email": user["email"], "name": user["name"], "role": user["role"], "created_at": user["created_at"]}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access_token = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ===================== CATEGORY ROUTES =====================

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0, "id": {"$toString": "$_id"}, "name": 1, "slug": 1, "icon": 1, "image_url": 1, "description": 1}).to_list(100)
    # Get deal counts
    for cat in categories:
        count = await db.coupons.count_documents({"category_name": cat["name"], "is_active": True})
        cat["deal_count"] = count
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

# ===================== BRAND ROUTES =====================

@api_router.get("/brands", response_model=List[BrandResponse])
async def get_brands():
    brands = await db.brands.find({}, {"_id": 0, "id": {"$toString": "$_id"}, "name": 1, "slug": 1, "logo_url": 1, "website_url": 1, "description": 1}).to_list(100)
    for brand in brands:
        count = await db.coupons.count_documents({"brand_name": brand["name"], "is_active": True})
        brand["deal_count"] = count
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
    return coupons

@api_router.get("/coupons/{coupon_id}", response_model=CouponResponse)
async def get_coupon(coupon_id: str):
    coupon = await db.coupons.find_one({"_id": ObjectId(coupon_id)}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    coupon["id"] = coupon_id
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
    """Calculate a deal score based on various factors"""
    score = 50.0  # Base score
    
    # Discount value bonus
    if coupon.get("discount_value"):
        if coupon["discount_type"] == "percentage":
            score += min(coupon["discount_value"], 50)  # Max 50 points for % discount
        else:
            score += min(coupon["discount_value"] / 100, 30)  # Flat discount
    
    # Verified bonus
    if coupon.get("is_verified"):
        score += 10
    
    # Featured bonus
    if coupon.get("is_featured"):
        score += 15
    
    # Has code bonus
    if coupon.get("code"):
        score += 5
    
    return min(score, 100)  # Cap at 100

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
    
    return {
        "total_coupons": total_coupons,
        "active_coupons": active_coupons,
        "total_clicks": total_clicks,
        "total_users": total_users,
        "recent_clicks": recent_clicks,
        "top_brands": [{"name": b["_id"], "clicks": b["total_clicks"]} for b in top_brands]
    }

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

# Include the router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================== STARTUP & SHUTDOWN =====================

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
    
    logger.info("DISCCART API started successfully")

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@disccart.in")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    
    # Write credentials
    Path("/app/memory").mkdir(exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n")
        f.write(f"## Admin Account\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write(f"- Role: admin\n\n")
        f.write(f"## Auth Endpoints\n")
        f.write(f"- POST /api/auth/register\n")
        f.write(f"- POST /api/auth/login\n")
        f.write(f"- POST /api/auth/logout\n")
        f.write(f"- GET /api/auth/me\n")

async def seed_initial_data():
    """Seed initial categories and sample coupons"""
    
    # Check if data exists
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
    logger.info("Initial data seeded")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
