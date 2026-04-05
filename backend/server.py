from fastapi import FastAPI, APIRouter, Request, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, validator
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import os
import logging
import csv
import io
import bcrypt
import jwt
import re  # Added for slug generation
from dotenv import load_dotenv

# ===================== SETUP =====================
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.getenv("MONGO_URL")
JWT_SECRET = os.getenv("JWT_SECRET", "disccart_secret_2026_key")

client = AsyncIOMotorClient(MONGO_URL)
db = client["disccart"]

app = FastAPI(title="Disccart API")
api_router = APIRouter()

# ===================== MODELS =====================

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class CategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None  # Changed to Optional
    icon: Optional[str] = "Tag" # Added for UI icons
    description: Optional[str] = None

    # Automatically generate slug if missing
    @validator('slug', pre=True, always=True)
    def generate_slug(cls, v, values):
        if v:
            return v
        if 'name' in values:
            name = values['name']
            slug = name.lower().strip()
            slug = re.sub(r'[^a-z0-9\s-]', '', slug)
            slug = re.sub(r'[\s-]+', '-', slug)
            return slug
        return None

class CouponCreate(BaseModel):
    title: str
    brand_name: str
    category_name: str
    code: Optional[str] = None
    original_price: Optional[float] = 0.0
    discounted_price: Optional[float] = 0.0
    affiliate_url: str
    discount_type: str = "percentage"
    discount_value: float = 0
    is_active: bool = True

    # Fix: Ensure URLs always start with http/https for mobile redirection
    @validator('affiliate_url')
    def validate_url(cls, v):
        v = v.strip()
        if not v.startswith(('http://', 'https://')):
            return f'https://{v}'
        return v

# ===================== AUTH UTILS =====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str):
    payload = {
        "user_id": user_id, 
        "email": email, 
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

# ===================== API ROUTES =====================

@api_router.get("/auth/me")
async def get_me():
    return {"email": "disccartindia@gmail.com", "role": "admin"}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(str(user["_id"]), user["email"])
    return {
        "token": token, 
        "user": {"id": str(user["_id"]), "email": user["email"], "role": "admin"}
    }

@api_router.get("/analytics/overview")
async def get_analytics():
    return {
        "total_coupons": await db.coupons.count_documents({}),
        "active_coupons": await db.coupons.count_documents({"is_active": True}),
        "total_clicks": await db.clicks.count_documents({}),
        "total_users": await db.users.count_documents({}),
        "total_categories": await db.categories.count_documents({})
    }

# --- CATEGORIES ---
@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find().to_list(100)
    for c in cats:
        c["id"] = str(c.pop("_id"))
    return cats

@api_router.post("/categories")
async def add_cat(data: CategoryCreate):
    doc = data.model_dump()
    result = await db.categories.insert_one(doc)
    return {"id": str(result.inserted_id), **doc}

@api_router.delete("/categories/{cat_id}")
async def delete_cat(cat_id: str):
    try:
        await db.categories.delete_one({"_id": ObjectId(cat_id)})
        return {"message": "Deleted"}
    except:
        raise HTTPException(status_code=400, detail="Invalid ID format")

# --- COUPONS / DEALS ---
@api_router.get("/coupons")
@api_router.get("/coupons-only")
async def get_coupons(category: Optional[str] = None, isAdmin: bool = False):
    query = {}
    if not isAdmin:
        query["is_active"] = True
    
    if category and category not in ["All", "undefined", "null"]:
        query["category_name"] = category

    coupons = await db.coupons.find(query).sort("created_at", -1).to_list(1000)
    for c in coupons:
        c["id"] = str(c.pop("_id"))
    return coupons

@api_router.post("/coupons")
async def create_coupon(data: CouponCreate):
    doc = data.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.coupons.insert_one(doc)
    return {"id": str(result.inserted_id), "status": "success"}

@api_router.put("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, data: CouponCreate):
    await db.coupons.update_one(
        {"_id": ObjectId(coupon_id)}, 
        {"$set": data.model_dump()}
    )
    return {"status": "updated"}

@api_router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str):
    await db.coupons.delete_one({"_id": ObjectId(coupon_id)})
    return {"status": "deleted"}

# --- IMPROVED CLICK TRACKING ---
@api_router.post("/clicks")
async def track_click(request: Request):
    try:
        data = await request.json()
        click_doc = {
            "coupon_id": data.get("coupon_id"),
            "brand": data.get("brand"),
            "timestamp": datetime.now(timezone.utc),
            "ip": request.client.host
        }
        await db.clicks.insert_one(click_doc)
        return {"status": "tracked"}
    except Exception as e:
        logger.error(f"Click Error: {e}")
        return {"status": "error", "message": "Failed to track"}

@api_router.post("/coupons/bulk-upload")
async def bulk_upload(file: UploadFile = File(...)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    count = 0
    for row in reader:
        # Clean URL during bulk upload
        url = row.get("affiliate_url", "").strip()
        if url and not url.startswith(('http://', 'https://')):
            url = f'https://{url}'
        
        row["affiliate_url"] = url
        row["is_active"] = True
        row["created_at"] = datetime.now(timezone.utc)
        
        try:
            # Handle potential empty price strings from CSV
            orig = row.get("original_price")
            disc = row.get("discounted_price")
            row["original_price"] = float(orig) if orig and str(orig).strip() else 0.0
            row["discounted_price"] = float(disc) if disc and str(disc).strip() else 0.0
        except:
            row["original_price"] = 0.0
            row["discounted_price"] = 0.0
            
        await db.coupons.insert_one(row)
        count += 1
    return {"message": f"Successfully uploaded {count} deals"}

    # image upload 
import shutil

@api_router.post("/upload-image")
async def upload_image(image: UploadFile = File(...)):
    # Create a 'uploads' folder if it doesn't exist
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
    
    file_path = f"uploads/{image.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    # In production (Render), this URL would be your domain + path
    # For now, it returns the relative path or a placeholder
    return {"url": f"https://disccart-api.onrender.com/{file_path}"}

# ===================== APP CONFIG =====================

app.include_router(api_router, prefix="/api")

origins = [
    "https://disccart.in",
    "https://www.disccart.in",
    "https://disccart-frontend.vercel.app", 
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
    user = await db.users.find_one({"email": admin_email})
    if not user:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password("Admin@2026@"),
            "role": "admin", 
            "created_at": datetime.now(timezone.utc)
        })

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
    