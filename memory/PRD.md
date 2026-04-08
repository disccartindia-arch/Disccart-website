# DISCCART - AI-Powered Coupon & Deals Platform

## Original Problem Statement
Build DISCCART - an AI-powered coupon and deals platform with React + FastAPI + MongoDB. Core features: deal listing, high-conversion coupon reveal UX, admin panel, smart affiliate engine, AI Deal Score, and fake coupon detection.

## Tech Stack
- **Frontend**: React 18 + Vite 5, TailwindCSS, Shadcn UI, Framer Motion
- **Backend**: FastAPI (Python), Motor (async MongoDB)
- **Database**: MongoDB
- **Auth**: JWT (httpOnly cookies)
- **Analytics**: Google Analytics 4

## What's Implemented
- Phase 1: JWT Auth, Deal CRUD, Coupon Reveal Modal, Social Share
- Phase 2: SEO, GA4, Security Headers
- Phase 3: Admin Panel (7 tabs), Pretty Links, Pages CMS, Blog
- Phase 4: AI Deal Score, Verification Badges, Coupons Page
- Phase 5: Logo & Branding (green+orange palette)
- Phase 6: Vite Migration & Deployment Prep
- Phase 7: 5 High-Priority Technical Directives Fixed
- Phase 8: Admin & Data Sync Finalization (search, CRUD tables)
- Phase 9: UI & Data Bug Fixes (image preview, category bg, nullable prices)
- Phase 10: Master Fix (image fallback, redirect fix, limited time offers, category auto-sync)
- Phase 11: Wishlist + Expiry Countdown (April 7, 2026)
  - Wishlist system: heart icon on cards, /wishlist page, backend CRUD
  - Expiry countdown: live ticker (3d 4h left), admin date picker for limited deals
- Phase 12: Admin Multi-Select & Bulk Management (April 8, 2026)
  - Multi-select offer_type: checkbox group (Deal/Coupon/Limited Time), stored comma-separated
  - Multi-select categories: checkbox grid, stored comma-separated
  - Bulk select/delete: Select All checkbox, individual checkboxes, "Delete Selected" button
  - Bulk delete API: POST /api/coupons/bulk-delete {ids: [...]}
  - Image persistence: timestamp prefix on filenames, resolveImageUrl helper
  - Category count fix: regex match for comma-separated category_name
  - Removed hardcoded Render URLs, duplicate endpoints, dead code

## Key API Endpoints
- POST /api/auth/login
- GET /api/categories (coupon_count via regex)
- GET /api/coupons?category=slug&offer_type=limited (regex match)
- POST /api/coupons, PUT /api/coupons/{id} (CouponUpdate model)
- POST /api/coupons/bulk-delete {ids: [...]}
- POST /api/upload-image (timestamp prefix, /uploads/ static serving)
- CRUD: /api/pretty-links, /api/pages, /api/blog
- Wishlist: GET/POST/DELETE /api/wishlist/{user_id}
- GET /api/analytics/overview

## DB Schema
- `coupons`: {title, brand_name, category_name (comma-sep), code, affiliate_url, offer_type (comma-sep: deal,coupon,limited), image_url, original_price (nullable), discounted_price (nullable), expires_at (nullable), is_active, created_at}
- `categories`: {name, slug, icon, description, image_url, background_image_url}
- `users`: {email, password_hash, role, created_at}
- `wishlists`: {user_id, coupon_id, created_at}
- `clicks`: {coupon_id, brand, timestamp, ip}

## Phase 13: Stability & Build Fixes (Feb 2026)
- Verified .map() crash fix across all pages — 100% pass rate (iteration 9)
- Added chunkSizeWarningLimit: 1000 to vite.config.js build config

## Backlog
- P1: Facebook Pixel tracking implementation
- P2: Email capture popup for deal alerts
- P2: Push notifications (Firebase)
- P2: "Best time to buy" hint
