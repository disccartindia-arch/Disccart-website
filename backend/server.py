from fastapi import FastAPI, APIRouter, Request, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import os
import logging
import csv
import io
import bcrypt
import jwt
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
    slug: str
    description: Optional[str] = None

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

# --- CATEGORIES (Fixes Add/Delete Issue) ---
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
    # If it's a regular user on a phone, only show active ones
    if not isAdmin:
        query["is_active"] = True
    
    # Handle category filtering
    if category and category != "All" and category != "undefined":
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

@api_router.post("/clicks")
async def track_click(request: Request):
    try:
        data = await request.json()
        data["timestamp"] = datetime.now(timezone.utc)
        await db.clicks.insert_one(data)
        return {"status": "tracked"}
    except:
        return {"status": "error"}

@api_router.post("/coupons/bulk-upload")
async def bulk_upload(file: UploadFile = File(...)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    count = 0
    for row in reader:
        row["is_active"] = True
        row["created_at"] = datetime.now(timezone.utc)
        try:
            row["original_price"] = float(row.get("original_price", 0))
            row["discounted_price"] = float(row.get("discounted_price", 0))
        except:
            pass
        await db.coupons.insert_one(row)
        count += 1
    return {"message": f"Successfully uploaded {count} deals"}

# ===================== APP CONFIG =====================

app.include_router(api_router, prefix="/api")

# CRITICAL FIX: If using credentials, you cannot use "*"
# Update this list with your actual Vercel URL
origins = [
    "https://disccart.in",
    "https://www.disccart.in",
    "https://disccart-frontend.vercel.app", # Replace with your actual vercel link
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
    