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
  - API 404s resolved (pretty-links, blog, pages routes restored)
  - Image upload endpoint working (POST /api/upload-image)
  - Offer type segregation (coupon/deal) added to model + admin UI
  - Coupon redirect popup fallback (window.location.href)
  - Category coupon count mismatch fixed (.count_documents per category)
  - api.js garbage/merge-conflict code cleaned up
  - CouponRevealModal duplicate handleRedirect removed
  - AdminPage.jsx extreme indentation fixed, DialogDescription added (ARIA)
  - CORS middleware moved before router (correct ordering)

## Build System
- **Build tool**: Vite 5.4
- **Entry**: `frontend/index.html` -> `src/main.jsx`
- **Env vars**: `VITE_BACKEND_URL`, `VITE_GA_MEASUREMENT_ID`
- **Output**: `dist/` directory
- **Node**: Compatible with 18+ and 20+

## Deployment
- Backend: Render (free) - `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Frontend: Vercel - Vite preset, output `dist/`
- Database: MongoDB Atlas (free M0)

## Admin Credentials
- Email: disccartindia@gmail.com
- Password: Admin@2026@

## Key API Endpoints
- POST /api/auth/login
- GET /api/categories (includes coupon_count)
- GET/POST/PUT/DELETE /api/coupons (includes offer_type)
- POST /api/upload-image
- GET/POST/PUT/DELETE /api/pretty-links
- GET/POST/PUT/DELETE /api/pages
- GET/POST/PUT/DELETE /api/blog
- GET /api/analytics/overview
- POST /api/clicks

## DB Schema
- `coupons`: {title, brand_name, category_name, code, affiliate_url, offer_type, image_url, original_price, discounted_price, discount_type, discount_value, is_active, created_at}
- `categories`: {name, slug, icon, description, image_url}
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
