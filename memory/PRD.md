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
- Phase 2: SEO (Sitemap, Meta Tags, Robots.txt), GA4, Security Headers
- Phase 3: Admin Panel (7 tabs), Pretty Links, Static Pages CMS, Blog
- Phase 4: AI Deal Score (0-100), Verification Badges, Coupons Page
- Phase 5: Logo & Branding (green+orange palette from logo)
- Phase 6: Vite Migration & Deployment Prep (March 31, 2026)
- Phase 7: 5 High-Priority Technical Directives Fixed (April 5, 2026)
- Phase 8: Admin & Data Sync Finalization (April 5, 2026)
- Phase 9: UI & Data Bug Fixes (April 6, 2026)
- Phase 10: Master Fix & Feature Implementation (April 7, 2026)
  - Image fallback: onError handler on DealCard replaces broken images with gradient placeholder
  - Redirect fix: CouponRevealModal uses window.open ONLY, no window.location.href redirect
  - Limited Time Offer system: offer_type=limited, homepage section, admin dropdown, /deals/limited-time page, red badge in admin table
  - Category auto-sync: CategoryPage uses api.js (no hardcoded URL), backend slug-to-name DB lookup, case-insensitive matching, fixed DB slugs
  - Fixed category count display on homepage (coupon_count not deal_count)
  - Fixed category slugs in DB (food-dining, home-living)

## Build System
- **Build tool**: Vite 5.4
- **Entry**: `frontend/index.html` -> `src/main.jsx`
- **Env vars**: `VITE_BACKEND_URL`, `VITE_GA_MEASUREMENT_ID`

## Key API Endpoints
- POST /api/auth/login
- GET /api/categories (includes coupon_count, background_image_url)
- GET /api/coupons?category=slug&offer_type=limited (slug-to-name lookup, case-insensitive)
- POST/PUT/DELETE /api/coupons (offer_type: coupon|deal|limited, nullable prices)
- POST /api/upload-image → /uploads/filename (StaticFiles mount)
- GET/POST/PUT/DELETE /api/pretty-links, /api/pages, /api/blog
- GET /api/analytics/overview
- POST /api/clicks

## DB Schema
- `coupons`: {title, brand_name, category_name, code, affiliate_url, offer_type (coupon|deal|limited), image_url, original_price (nullable), discounted_price (nullable), discount_type, discount_value, is_active, created_at}
- `categories`: {name, slug, icon, description, image_url, background_image_url}
- `users`: {email, password_hash, role, created_at}
- `clicks`: {coupon_id, brand, timestamp, ip}
- `pretty_links`: {slug, destination_url, title, description, is_active, clicks}
- `pages`: {slug, title, content, meta_description, is_published}
- `blog_posts`: {slug, title, content, published, created_at}

## Backlog
- P1: Facebook Pixel tracking implementation
- P2: User wishlist system
- P2: Email capture popup for deal alerts
- P2: Push notifications (Firebase)
- P2: "Best time to buy" hint
