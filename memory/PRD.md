# DISCCART - AI-Powered Coupon & Deals Platform

## Original Problem Statement
Build DISCCART – an AI-powered coupon and deals platform. Scalable startup platform with React + FastAPI + MongoDB. Core features: deal listing, high-conversion coupon reveal UX (auto-copy, countdown timer), admin panel, SEO pages, smart affiliate engine (pretty links).

## Tech Stack
- **Frontend**: React.js, TailwindCSS, Shadcn UI, Framer Motion, React Helmet Async, React Markdown
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **Auth**: JWT (httpOnly cookies, access + refresh tokens)
- **Analytics**: Google Analytics 4 (G-Y5T6ECMHE2)

## What's Implemented

### Phase 1 - MVP: JWT Auth, Deal CRUD, Coupon Reveal Modal, Social Share, Homepage
### Phase 2 - SEO & Analytics: Sitemap, Robots.txt, Meta Tags, GA4, Security Headers
### Phase 3 - CMS: Admin Panel (7 tabs), Pretty Links, Static Pages, Blog, Footer
### Phase 4 - Deal Score & Coupons: AI scoring (0-100), Verification badges, Coupons page
### Phase 5 - Branding: Logo update (cart+% icon), Green+Orange gradient text, color palette alignment
### Phase 6 - Deployment Prep (March 30, 2026):
- Created `main.py` entry point for Render deployment
- Created `Procfile` and `render.yaml` for Render
- Created `vercel.json` for Vercel SPA routing
- Created `requirements.prod.txt` (minimal production dependencies)
- Created comprehensive `DEPLOYMENT_GUIDE.md` with step-by-step instructions
- Updated `.gitignore` and `README.md`
- Deployment architecture: Render (backend) + Vercel (frontend) + MongoDB Atlas

## Backlog
### P1
- Facebook Pixel tracking (actual implementation)
### P2
- User wishlist system
- Email capture popup for deal alerts
- Push notifications (Firebase)
- "Best time to buy" hints

## Admin Credentials
- Email: disccartindia@gmail.com
- Password: Admin@2026@
