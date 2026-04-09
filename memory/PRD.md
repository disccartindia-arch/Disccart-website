# DISCCART - AI-Powered Coupon & Deals Platform

## Original Problem Statement
Build DISCCART - an AI-powered coupon and deals platform with React + FastAPI + MongoDB. Core features: deal listing, high-conversion coupon reveal UX, admin panel, smart affiliate engine, AI Deal Score, and fake coupon detection.

## Tech Stack
- **Frontend**: React 18 + Vite 5, TailwindCSS, Shadcn UI, Framer Motion
- **Backend**: FastAPI (Python), Motor (async MongoDB)
- **Database**: MongoDB
- **Auth**: JWT (Bearer token in localStorage)
- **Image Hosting**: Cloudinary
- **Analytics**: Google Analytics 4

## What's Implemented
- Phase 1-12: Core MVP (auth, deals, admin, wishlist, bulk mgmt, AI scores, etc.)
- Phase 13: Stability (.map crash fix, chunkSizeWarningLimit)
- Phase 14: Dynamic filters, Cloudinary, Stores CRUD, Filter drawer
- Phase 15: Secure Auth + Slider (April 9, 2026)
  - JWT auth with role-based access (admin/user)
  - /auth/register endpoint (new users get role=user)
  - /auth/me requires Bearer token (was hardcoded before)
  - admin_required dependency on all admin routes (403 for non-admin)
  - Frontend AdminRoute guard (redirects non-admin to /)
  - Header hides Admin Panel link for non-admin users
  - api.js interceptor attaches Bearer token to all requests
  - Homepage Slider (homepage_slides collection, max 5 active)
  - Admin Slider tab with image upload, redirect URL, order, active toggle
  - HeroSlider component with auto-slide, pause/play, nav dots
  - Cloudinary startup validation (clear error if env vars missing)
  - Dialog accessibility (DialogDescription on all 7 dialogs)

## Key API Endpoints
- POST /api/auth/login (returns JWT with role)
- POST /api/auth/register (creates user with role=user)
- GET /api/auth/me (requires Bearer token)
- GET /api/categories, POST/PUT/DELETE /api/categories
- GET /api/coupons, POST/PUT/DELETE /api/coupons
- POST /api/coupons/bulk-delete
- POST /api/upload-image (Cloudinary)
- GET /api/stores, POST/PUT/DELETE /api/stores/{id}
- GET /api/admin/filters, PATCH /api/admin/filters (admin only)
- GET /api/deals/filtered
- GET /api/slides (public), GET/POST/PATCH/DELETE /api/admin/slides (admin only)
- CRUD: /api/pretty-links, /api/pages, /api/blog
- Wishlist: GET/POST/DELETE /api/wishlist/{user_id}
- GET /api/analytics/overview

## DB Collections
- `coupons`: {title, brand_name, category_name, code, affiliate_url, offer_type (nullable), image_url, original_price (int), discounted_price (int), expires_at, is_active}
- `categories`: {name, slug, icon, image_url, background_image_url, show_in_filter}
- `stores`: {name, logo_url, show_in_filter}
- `filter_configs`: {_id: "global", price_brackets: [{label, min, max}]}
- `homepage_slides`: {image_url, redirect_url, is_active, order}
- `users`: {email, password_hash, role (admin|user), created_at}
- `wishlists`, `clicks`, `pretty_links`, `pages`, `blog_posts`

## Environment Variables (Backend)
- MONGO_URL, DB_NAME
- JWT_SECRET
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- CORS_ORIGINS
- ADMIN_EMAIL, ADMIN_PASSWORD

## Backlog
- P1: Facebook Pixel tracking implementation
- P2: Email capture popup for deal alerts
- P2: Push notifications (Firebase)
- P2: "Best time to buy" hint
