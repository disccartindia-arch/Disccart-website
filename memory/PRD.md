# DISCCART - AI-Powered Coupon & Deals Platform

## Original Problem Statement
Build DISCCART - an AI-powered coupon and deals platform with React + FastAPI + MongoDB. Core features: deal listing, high-conversion coupon reveal UX, admin panel, smart affiliate engine, AI Deal Score, and fake coupon detection.

## Tech Stack
- **Frontend**: React 18 + Vite 5, TailwindCSS, Shadcn UI, Framer Motion
- **Backend**: FastAPI (Python), Motor (async MongoDB)
- **Database**: MongoDB
- **Auth**: JWT (httpOnly cookies)
- **Image Hosting**: Cloudinary
- **Analytics**: Google Analytics 4

## What's Implemented
- Phase 1: JWT Auth, Deal CRUD, Coupon Reveal Modal, Social Share
- Phase 2: SEO, GA4, Security Headers
- Phase 3: Admin Panel (9 tabs), Pretty Links, Pages CMS, Blog
- Phase 4: AI Deal Score, Verification Badges, Coupons Page
- Phase 5: Logo & Branding (green+orange palette)
- Phase 6: Vite Migration & Deployment Prep
- Phase 7: 5 High-Priority Technical Directives Fixed
- Phase 8: Admin & Data Sync Finalization (search, CRUD tables)
- Phase 9: UI & Data Bug Fixes (image preview, category bg, nullable prices)
- Phase 10: Master Fix (image fallback, redirect fix, limited time offers, category auto-sync)
- Phase 11: Wishlist + Expiry Countdown
- Phase 12: Admin Multi-Select & Bulk Management
- Phase 13: Stability & Build Fixes (.map crash fix, chunkSizeWarningLimit)
- Phase 14: Dynamic Filter System + Cloudinary + Stores (April 9, 2026)
  - Cloudinary image upload (auto webp, auto quality)
  - Stores collection with full CRUD + admin tab
  - Filter config system (filter_configs collection, price brackets)
  - Category/Store show_in_filter toggles
  - Admin Filter Settings tab (brackets editor, visibility toggles)
  - Frontend FilterDrawer (floating FAB, slide-in drawer, price/category/store filters)
  - Filtered Deals API with $facet aggregation
  - Offer type null-safe rendering (no badge if null)
  - Prices stored as integers
  - CORS reads from env var + hardcoded fallback

## Key API Endpoints
- POST /api/auth/login
- GET /api/categories (coupon_count via regex)
- GET /api/coupons?category=slug&offer_type=limited
- POST /api/coupons, PUT /api/coupons/{id}
- POST /api/coupons/bulk-delete {ids: [...]}
- POST /api/upload-image (Cloudinary)
- GET /api/stores, POST/PUT/DELETE /api/stores/{id}
- GET /api/admin/filters, PATCH /api/admin/filters
- GET /api/deals/filtered?category=&store=&min_price=&max_price=
- CRUD: /api/pretty-links, /api/pages, /api/blog
- Wishlist: GET/POST/DELETE /api/wishlist/{user_id}
- GET /api/analytics/overview

## DB Schema
- `coupons`: {title, brand_name, category_name, code, affiliate_url, offer_type (nullable), image_url, original_price (int), discounted_price (int), expires_at, is_active, created_at}
- `categories`: {name, slug, icon, description, image_url, background_image_url, show_in_filter}
- `stores`: {name, logo_url, show_in_filter, created_at}
- `filter_configs`: {_id: "global", price_brackets: [{label, min, max}]}
- `users`: {email, password_hash, role, created_at}
- `wishlists`: {user_id, coupon_id, created_at}
- `clicks`: {coupon_id, brand, timestamp, ip}

## Backlog
- P1: Facebook Pixel tracking implementation
- P2: Email capture popup for deal alerts
- P2: Push notifications (Firebase)
- P2: "Best time to buy" hint
