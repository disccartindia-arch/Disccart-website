# DISCCART - AI-Powered Coupon & Deals Platform

## Original Problem Statement
Build DISCCART – an AI-powered coupon and deals platform with React + FastAPI + MongoDB.

## Tech Stack
- **Frontend**: React 18 + **Vite 5** (migrated from CRA/CRACO), TailwindCSS, Shadcn UI, Framer Motion
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

## Build System (Current)
- **Build tool**: Vite 5.4 (NOT CRA/CRACO)
- **Entry**: `frontend/index.html` → `src/main.jsx`
- **Env vars**: `VITE_BACKEND_URL`, `VITE_GA_MEASUREMENT_ID` (VITE_ prefix)
- **Output**: `dist/` directory
- **Config files**: `vite.config.js`, `postcss.config.cjs`, `tailwind.config.cjs`
- **Scripts**: `npm run dev`, `npm run build`, `npm run preview`
- **Node**: Compatible with 18+ and 20+

## Deployment
- Backend: Render (free) — `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Frontend: Vercel — Vite preset, output `dist/`
- Database: MongoDB Atlas (free M0)
- See DEPLOYMENT_GUIDE.md for full instructions

## Admin Credentials
- Email: disccartindia@gmail.com
- Password: Admin@2026@

## Backlog
- P1: Facebook Pixel tracking
- P2: User wishlist, email capture, push notifications
