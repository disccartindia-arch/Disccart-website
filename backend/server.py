from fastapi import FastAPI, APIRouter, Request, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
import re
import shutil
from dotenv import load_dotenv

# ===================== SETUP =====================
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.getenv("MONGO_URL")
JWT_SECRET = os.getenv("JWT_SECRET", "disccart_secret_2026_key")

client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "disccart")]

app = FastAPI(title="Disccart API")

# ===================== CORS (must be before routes) =====================
origins = [
    "https://disccart.in",
    "https://www.disccart.in",
    "https://disccart-frontend.vercel.app",
    "https://coupon-hub-35.preview.emergentagent.com",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter()

# ===================== MODELS =====================

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class CategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    icon: Optional[str] = "Tag"
    description: Optional[str] = None
    image_url: Optional[str] = None
    background_image_url: Optional[str] = None

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
    original_price: Optional[float] = None
    discounted_price: Optional[float] = None
    affiliate_url: str
    discount_type: str = "percentage"
    discount_value: float = 0
    is_active: bool = True
    offer_type: Optional[str] = "coupon"
    image_url: Optional[str] = None
    description: Optional[str] = None

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

# ===================== AUTH ROUTES =====================

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

# ===================== ANALYTICS =====================

@api_router.get("/analytics/overview")
async def get_analytics():
    return {
        "total_coupons": await db.coupons.count_documents({}),
        "active_coupons": await db.coupons.count_documents({"is_active": True}),
        "total_clicks": await db.clicks.count_documents({}),
        "total_users": await db.users.count_documents({}),
        "total_categories": await db.categories.count_documents({})
    }

# ===================== CATEGORIES =====================

@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find().to_list(100)
    result = []
    for c in cats:
        cat_name = c.get("name", "")
        coupon_count = await db.coupons.count_documents({"category_name": cat_name})
        cat_doc = {
            "id": str(c.pop("_id")),
            "coupon_count": coupon_count,
        }
        # Merge remaining fields excluding _id
        for k, v in c.items():
            cat_doc[k] = v
        result.append(cat_doc)
    return result

@api_router.post("/categories")
async def add_cat(data: CategoryCreate):
    doc = data.model_dump()
    result = await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return {"id": str(result.inserted_id), **doc}

@api_router.put("/categories/{cat_id}")
async def update_cat(cat_id: str, data: CategoryCreate):
    try:
        await db.categories.update_one(
            {"_id": ObjectId(cat_id)},
            {"$set": data.model_dump()}
        )
        return {"status": "updated"}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")

@api_router.delete("/categories/{cat_id}")
async def delete_cat(cat_id: str):
    try:
        await db.categories.delete_one({"_id": ObjectId(cat_id)})
        return {"message": "Deleted"}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")

# ===================== COUPONS / DEALS =====================

@api_router.get("/coupons")
@api_router.get("/coupons-only")
async def get_coupons(category: Optional[str] = None, offer_type: Optional[str] = None, isAdmin: bool = False):
    query = {}
    if not isAdmin:
        query["is_active"] = True

    if category and category not in ["All", "undefined", "null"]:
        # First try to find category by slug to get the real name
        cat_doc = await db.categories.find_one({"slug": category})
        if cat_doc:
            query["category_name"] = cat_doc["name"]
        else:
            # Fallback: try slug-style match (e.g., "food-dining" matches "Food & Dining")
            slug_pattern = category.replace("-", ".+")
            query["category_name"] = {"$regex": f"^{slug_pattern}$", "$options": "i"}

    if offer_type and offer_type not in ["undefined", "null"]:
        query["offer_type"] = offer_type

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

# ===================== CLICK TRACKING =====================

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

# ===================== BULK UPLOAD =====================

@api_router.post("/coupons/bulk-upload")
async def bulk_upload(file: UploadFile = File(...)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    count = 0
    for row in reader:
        url = row.get("affiliate_url", "").strip()
        if url and not url.startswith(('http://', 'https://')):
            url = f'https://{url}'

        row["affiliate_url"] = url
        row["is_active"] = True
        row["created_at"] = datetime.now(timezone.utc)

        try:
            orig = row.get("original_price")
            disc = row.get("discounted_price")
            row["original_price"] = float(orig) if orig and str(orig).strip() else 0.0
            row["discounted_price"] = float(disc) if disc and str(disc).strip() else 0.0
        except Exception:
            row["original_price"] = 0.0
            row["discounted_price"] = 0.0

        await db.coupons.insert_one(row)
        count += 1
    return {"message": f"Successfully uploaded {count} deals"}

# ===================== IMAGE UPLOAD =====================

@api_router.post("/upload-image")
async def upload_image(image: UploadFile = File(...)):
    if not os.path.exists("uploads"):
        os.makedirs("uploads")

    file_path = f"uploads/{image.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    return {"url": f"/{file_path}"}

# ===================== PRETTY LINKS (Placeholder) =====================

@api_router.get("/pretty-links")
async def get_pretty_links():
    links = await db.pretty_links.find().to_list(500)
    for l in links:
        l["id"] = str(l.pop("_id"))
    return links

@api_router.post("/pretty-links")
async def create_pretty_link(request: Request):
    data = await request.json()
    data["created_at"] = datetime.now(timezone.utc)
    result = await db.pretty_links.insert_one(data)
    return {"id": str(result.inserted_id), "status": "created"}

@api_router.put("/pretty-links/{link_id}")
async def update_pretty_link(link_id: str, request: Request):
    data = await request.json()
    await db.pretty_links.update_one({"_id": ObjectId(link_id)}, {"$set": data})
    return {"status": "updated"}

@api_router.delete("/pretty-links/{link_id}")
async def delete_pretty_link(link_id: str):
    await db.pretty_links.delete_one({"_id": ObjectId(link_id)})
    return {"status": "deleted"}

# ===================== PAGES CMS (Placeholder) =====================

@api_router.get("/pages")
async def get_pages(published_only: bool = False):
    query = {"published": True} if published_only else {}
    pages = await db.pages.find(query).to_list(500)
    for p in pages:
        p["id"] = str(p.pop("_id"))
    return pages

@api_router.get("/pages/{slug}")
async def get_page(slug: str):
    page = await db.pages.find_one({"slug": slug})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page["id"] = str(page.pop("_id"))
    return page

@api_router.post("/pages")
async def create_page(request: Request):
    data = await request.json()
    data["created_at"] = datetime.now(timezone.utc)
    result = await db.pages.insert_one(data)
    return {"id": str(result.inserted_id), "status": "created"}

@api_router.put("/pages/{page_id}")
async def update_page(page_id: str, request: Request):
    data = await request.json()
    await db.pages.update_one({"_id": ObjectId(page_id)}, {"$set": data})
    return {"status": "updated"}

@api_router.delete("/pages/{page_id}")
async def delete_page(page_id: str):
    await db.pages.delete_one({"_id": ObjectId(page_id)})
    return {"status": "deleted"}

# ===================== BLOG (Placeholder) =====================

@api_router.get("/blog")
async def get_blog_posts(published_only: bool = True, limit: int = 20, skip: int = 0):
    query = {"published": True} if published_only else {}
    posts = await db.blog_posts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for p in posts:
        p["id"] = str(p.pop("_id"))
    return posts

@api_router.get("/blog/{slug}")
async def get_blog_post(slug: str):
    post = await db.blog_posts.find_one({"slug": slug})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post["id"] = str(post.pop("_id"))
    return post

@api_router.post("/blog")
async def create_blog_post(request: Request):
    data = await request.json()
    data["created_at"] = datetime.now(timezone.utc)
    result = await db.blog_posts.insert_one(data)
    return {"id": str(result.inserted_id), "status": "created"}

@api_router.put("/blog/{post_id}")
async def update_blog_post(post_id: str, request: Request):
    data = await request.json()
    await db.blog_posts.update_one({"_id": ObjectId(post_id)}, {"$set": data})
    return {"status": "updated"}

@api_router.delete("/blog/{post_id}")
async def delete_blog_post(post_id: str):
    await db.blog_posts.delete_one({"_id": ObjectId(post_id)})
    return {"status": "deleted"}

# ===================== APP CONFIG =====================

app.include_router(api_router, prefix="/api")

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.on_event("startup")
async def startup():
    admin_email = os.getenv("ADMIN_EMAIL", "disccartindia@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "Admin@2026@")
    user = await db.users.find_one({"email": admin_email})
    if not user:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user seeded: {admin_email}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
