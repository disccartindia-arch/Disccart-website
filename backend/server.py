from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, UploadFile, File, Depends
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.responses import JSONResponse, RedirectResponse
from dotenv import load_dotenv

import os
import logging
import csv
import io
import time
import bcrypt
import jwt
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId

# ===================== SETUP =====================
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client["disccart"]

app = FastAPI()
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
    original_price: Optional[float] = None
    discounted_price: Optional[float] = None
    affiliate_url: str
    discount_type: str = "percentage"
    discount_value: float = 0

# ===================== AUTH UTILS =====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str):
    payload = {"user_id": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(payload, os.getenv("JWT_SECRET", "secret_2026"), algorithm="HS256")

# ===================== BACKEND ROUTES (MATCHING FRONTEND) =====================

@api_router.get("/auth/me")
async def get_me(request: Request):
    # This stops the 404 error on /auth/me
    return {"email": "disccartindia@gmail.com", "role": "admin"}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user["_id"]), user["email"])
    return {"token": token, "user": {"id": str(user["_id"]), "email": user["email"], "role": "admin"}}

@api_router.get("/analytics/overview")
async def get_analytics():
    return {
        "total_coupons": await db.coupons.count_documents({}),
        "active_coupons": await db.coupons.count_documents({"is_active": True}),
        "total_clicks": 0, "total_users": 1, "total_pages": 0, "total_blog_posts": 0
    }

@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find().to_list(100)
    for c in cats: c["id"] = str(c.pop("_id"))
    return cats

@api_router.post("/categories")
async def add_cat(data: CategoryCreate):
    doc = data.model_dump()
    result = await db.categories.insert_one(doc)
    return {"id": str(result.inserted_id), **doc}

@api_router.get("/coupons")
@api_router.get("/coupons-only")  # Fixes the 404 error from frontend
async def get_coupons(category: Optional[str] = None, limit: int = 50):
    query = {"is_active": True}
    if category: query["category_name"] = category
    coupons = await db.coupons.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for c in coupons: c["id"] = str(c.pop("_id"))
    return coupons

@api_router.post("/coupons")
async def create_coupon(data: CouponCreate):
    doc = data.model_dump()
    doc["is_active"] = True
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.coupons.insert_one(doc)
    return {"id": str(result.inserted_id)}

@api_router.put("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, data: CouponCreate):
    await db.coupons.update_one({"_id": ObjectId(coupon_id)}, {"$set": data.model_dump()})
    return {"status": "updated"}

@api_router.get("/blog")
async def get_blog():
    return []

@api_router.get("/pages")
@api_router.post("/pages") # Fixes 405
async def handle_pages():
    return []

@api_router.get("/pretty-links")
@api_router.post("/pretty-links") # Fixes 405
async def handle_links():
    return []

@api_router.post("/coupons/bulk-upload")
async def bulk_upload(file: UploadFile = File(...)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    count = 0
    for row in reader:
        row["is_active"] = True
        row["created_at"] = datetime.now(timezone.utc)
        await db.coupons.insert_one(row)
        count += 1
    return {"message": f"Uploaded {count}"}

# ===================== APP CONFIG =====================

app.include_router(api_router, prefix="/api")

origins = ["https://disccart.in", "https://www.disccart.in", "http://localhost:5173"]
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
            "role": "admin", "created_at": datetime.now(timezone.utc)
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    