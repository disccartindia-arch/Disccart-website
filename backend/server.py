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
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

# ===================== SETUP =====================
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.getenv("MONGO_URL")
JWT_SECRET = os.getenv("JWT_SECRET", "disccart_secret_2026_key")

# Cloudinary config
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "disccart")]

app = FastAPI(title="Disccart API")
UPLOAD_DIR = "uploads"

# Create folder if not exists
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Serve images
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ===================== CORS (must be before routes) =====================
cors_env = os.environ.get("CORS_ORIGINS", "")
origins = [o.strip() for o in cors_env.split(",") if o.strip()] if cors_env else []
origins += [
    "https://disccart.in",
    "https://www.disccart.in",
    "https://disccart-frontend.vercel.app",
    "https://coupon-hub-35.preview.emergentagent.com",
    "http://localhost:5173",
    "http://localhost:3000",
]
origins = list(set(origins))

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
    show_in_filter: bool = True

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
    original_price: Optional[int] = None
    discounted_price: Optional[int] = None
    affiliate_url: str
    discount_type: str = "percentage"
    discount_value: float = 0
    is_active: bool = True
    offer_type: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    expires_at: Optional[str] = None

    @validator('affiliate_url')
    def validate_url(cls, v):
        v = v.strip()
        if not v.startswith(('http://', 'https://')):
            return f'https://{v}'
        return v

class CouponUpdate(BaseModel):
    title: str
    brand_name: str
    category_name: str
    original_price: Optional[int] = None
    discounted_price: Optional[int] = None
    affiliate_url: str
    image_url: Optional[str] = ""
    code: Optional[str] = None
    is_active: bool = True
    offer_type: Optional[str] = None
    description: Optional[str] = None
    expires_at: Optional[str] = None
    discount_type: str = "percentage"
    discount_value: float = 0

@api_router.put("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, coupon: CouponUpdate):
    update_data = coupon.dict()
    result = await db.coupons.update_one(
        {"_id": ObjectId(coupon_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"message": "Updated successfully"}
    

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
        coupon_count = await db.coupons.count_documents({
            "category_name": {"$regex": cat_name, "$options": "i"}
        })
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
        cat_name = cat_doc["name"] if cat_doc else category
        # Use regex to match within comma-separated category_name field
        query["category_name"] = {"$regex": cat_name, "$options": "i"}

    if offer_type and offer_type not in ["undefined", "null"]:
        query["offer_type"] = {"$regex": offer_type, "$options": "i"}

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

@api_router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str):
    await db.coupons.delete_one({"_id": ObjectId(coupon_id)})
    return {"status": "deleted"}

@api_router.post("/coupons/bulk-delete")
async def bulk_delete_coupons(request: Request):
    data = await request.json()
    ids = data.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    deleted = 0
    for cid in ids:
        try:
            result = await db.coupons.delete_one({"_id": ObjectId(cid)})
            deleted += result.deleted_count
        except Exception:
            pass
    return {"deleted": deleted, "status": "success"}

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

# ===================== IMAGE UPLOAD (Cloudinary) =====================

@api_router.post("/upload-image")
async def upload_image(image: UploadFile = File(...)):
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif"]
    if image.content_type and image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {image.content_type}. Allowed: JPG, PNG, WebP, GIF")

    # Validate file size (2MB max)
    contents = await image.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 2MB.")

    try:
        result = cloudinary.uploader.upload(
            contents,
            folder="disccart",
            resource_type="image",
            transformation=[
                {"quality": "auto", "fetch_format": "auto"}
            ]
        )
        return {"url": result["secure_url"]}
    except Exception as e:
        logger.error(f"Cloudinary upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===================== WISHLIST =====================

@api_router.get("/wishlist/{user_id}")
async def get_wishlist(user_id: str):
    items = await db.wishlists.find({"user_id": user_id}).to_list(500)
    coupon_ids = [item.get("coupon_id") for item in items]
    coupons = []
    for cid in coupon_ids:
        try:
            coupon = await db.coupons.find_one({"_id": ObjectId(cid)})
            if coupon:
                coupon["id"] = str(coupon.pop("_id"))
                coupons.append(coupon)
        except Exception:
            pass
    return coupons

@api_router.get("/wishlist/{user_id}/ids")
async def get_wishlist_ids(user_id: str):
    items = await db.wishlists.find({"user_id": user_id}).to_list(500)
    return [item.get("coupon_id") for item in items]

@api_router.post("/wishlist")
async def add_to_wishlist(request: Request):
    data = await request.json()
    user_id = data.get("user_id")
    coupon_id = data.get("coupon_id")
    existing = await db.wishlists.find_one({"user_id": user_id, "coupon_id": coupon_id})
    if existing:
        return {"status": "already_exists"}
    await db.wishlists.insert_one({
        "user_id": user_id,
        "coupon_id": coupon_id,
        "created_at": datetime.now(timezone.utc)
    })
    return {"status": "added"}

@api_router.delete("/wishlist/{user_id}/{coupon_id}")
async def remove_from_wishlist(user_id: str, coupon_id: str):
    await db.wishlists.delete_one({"user_id": user_id, "coupon_id": coupon_id})
    return {"status": "removed"}

# ===================== PRETTY LINKS (Placeholder) =====================

@api_router.get("/pretty-links")
async def get_pretty_links():
    links = await db.pretty_links.find().to_list(500)
    for link in links:
        link["id"] = str(link.pop("_id"))
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

# ===================== STORES =====================

@api_router.get("/stores")
async def get_stores():
    stores = await db.stores.find().to_list(500)
    for s in stores:
        s["id"] = str(s.pop("_id"))
    return stores

@api_router.post("/stores")
async def create_store(request: Request):
    data = await request.json()
    data["show_in_filter"] = data.get("show_in_filter", True)
    data["created_at"] = datetime.now(timezone.utc)
    result = await db.stores.insert_one(data)
    return {"id": str(result.inserted_id), "status": "created"}

@api_router.put("/stores/{store_id}")
async def update_store(store_id: str, request: Request):
    data = await request.json()
    data.pop("_id", None)
    data.pop("id", None)
    await db.stores.update_one({"_id": ObjectId(store_id)}, {"$set": data})
    return {"status": "updated"}

@api_router.delete("/stores/{store_id}")
async def delete_store(store_id: str):
    await db.stores.delete_one({"_id": ObjectId(store_id)})
    return {"status": "deleted"}

# ===================== FILTER CONFIG =====================

@api_router.get("/admin/filters")
async def get_filter_config():
    config = await db.filter_configs.find_one({"_id": "global"})
    price_brackets = config.get("price_brackets", []) if config else []

    categories = await db.categories.find().to_list(500)
    for c in categories:
        c["id"] = str(c.pop("_id"))

    stores = await db.stores.find().to_list(500)
    for s in stores:
        s["id"] = str(s.pop("_id"))

    return {
        "price_brackets": price_brackets,
        "categories": categories,
        "stores": stores
    }

@api_router.patch("/admin/filters")
async def update_filter_config(request: Request):
    data = await request.json()

    # Validate price brackets
    brackets = data.get("price_brackets")
    if brackets is not None:
        for b in brackets:
            if b.get("min", 0) > b.get("max", 0):
                raise HTTPException(status_code=400, detail=f"Invalid bracket: min ({b['min']}) > max ({b['max']})")
        await db.filter_configs.update_one(
            {"_id": "global"},
            {"$set": {"price_brackets": brackets}},
            upsert=True
        )

    # Update category show_in_filter flags
    cat_updates = data.get("categories", [])
    for cat in cat_updates:
        cid = cat.get("id")
        if cid:
            await db.categories.update_one(
                {"_id": ObjectId(cid)},
                {"$set": {"show_in_filter": cat.get("show_in_filter", True)}}
            )

    # Update store show_in_filter flags
    store_updates = data.get("stores", [])
    for store in store_updates:
        sid = store.get("id")
        if sid:
            await db.stores.update_one(
                {"_id": ObjectId(sid)},
                {"$set": {"show_in_filter": store.get("show_in_filter", True)}}
            )

    return {"status": "updated"}

# ===================== FILTERED DEALS =====================

@api_router.get("/deals/filtered")
async def get_filtered_deals(
    category: Optional[str] = None,
    store: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    offer_type: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    match_stage = {"is_active": True}

    if category and category not in ["All", "undefined", "null"]:
        match_stage["category_name"] = {"$regex": category, "$options": "i"}

    if store and store not in ["All", "undefined", "null"]:
        match_stage["brand_name"] = {"$regex": f"^{re.escape(store)}$", "$options": "i"}

    if offer_type and offer_type not in ["undefined", "null"]:
        match_stage["offer_type"] = {"$regex": offer_type, "$options": "i"}

    # Price filtering: check both discounted_price and original_price
    if min_price is not None or max_price is not None:
        price_cond = {}
        if min_price is not None:
            price_cond["$gte"] = min_price
        if max_price is not None:
            price_cond["$lte"] = max_price
        match_stage["$or"] = [
            {"discounted_price": price_cond},
            {"discounted_price": {"$in": [None, 0]}, "original_price": price_cond}
        ]

    pipeline = [
        {"$match": match_stage},
        {"$facet": {
            "results": [
                {"$sort": {"created_at": -1}},
                {"$skip": skip},
                {"$limit": limit}
            ],
            "category_counts": [
                {"$group": {"_id": "$category_name", "count": {"$sum": 1}}}
            ],
            "total": [{"$count": "count"}]
        }}
    ]

    cursor = db.coupons.aggregate(pipeline)
    facet_result = await cursor.to_list(1)
    facet = facet_result[0] if facet_result else {"results": [], "category_counts": [], "total": []}

    results = facet.get("results", [])
    for r in results:
        r["id"] = str(r.pop("_id"))

    total = facet["total"][0]["count"] if facet.get("total") else 0

    return {
        "deals": results,
        "category_counts": facet.get("category_counts", []),
        "total": total
    }

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

