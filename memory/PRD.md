# DISCCART - AI Powered Coupon & Deals Platform

## Original Problem Statement
Build DISCCART – AI Powered Coupon & Deals Platform with:
- Deal discovery + savings engine
- Goal: Beat BuyHatke in speed + UX, Beat GrabOn in SEO

## MVP Scope (Phase 1)
- Deal listing with categories
- High-conversion coupon reveal UX
- Admin panel + CSV upload
- Basic SEO pages

## User Personas
1. **Deal Hunter** - Looking for best discounts across categories
2. **Brand Loyal** - Searches for specific brand coupons (Amazon, Myntra, etc.)
3. **Admin** - Manages deals, uploads coupons, tracks analytics

## Core Requirements (Static)
- Fast, mobile-first deal browsing
- One-click coupon reveal with urgency (countdown, social proof)
- Admin CRUD for deals
- Category-based filtering
- Search functionality

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Framer Motion
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Auth**: JWT-based (cookies)
- **AI**: OpenAI GPT-5.2 for content generation (configured)

## What's Been Implemented (2026-03-28)
### Backend
- [x] JWT authentication (login, register, logout, refresh)
- [x] Admin seeding with role-based access
- [x] Coupon CRUD endpoints
- [x] Category/Brand management
- [x] Click tracking & analytics
- [x] CSV bulk upload
- [x] SEO page data endpoints
- [x] AI content generation endpoint (OpenAI)
- [x] Brute force protection
- [x] Deal scoring algorithm

### Frontend
- [x] Homepage with hero, featured deals, categories
- [x] Category pills navigation
- [x] Deal cards with discount badges
- [x] Coupon reveal modal with:
  - Countdown timer
  - Auto-copy functionality
  - Social proof ("93% saved money")
  - Redirect to affiliate link
- [x] Categories page
- [x] Trending page
- [x] Search page
- [x] SEO pages (/deals/amazon-coupons, etc.)
- [x] Login/Register pages
- [x] Profile page
- [x] Admin Panel with:
  - Dashboard analytics
  - Coupons table
  - Add/Edit coupon form
  - CSV bulk upload
- [x] Mobile bottom navigation
- [x] Responsive design

### Social Media Integration (2026-03-28)
- [x] WhatsApp share button with pre-filled message
- [x] Telegram share button with pre-filled message
- [x] Instagram profile link button
- [x] Copy Link button with toast notification
- [x] Share buttons on all deal cards
- [x] Share buttons in coupon reveal modal
- [x] Footer with social media links
- [x] Mobile responsive share buttons

## Test Credentials
- Admin: admin@disccart.in / DisccartAdmin2024!

## Prioritized Backlog

### P0 (Critical for Launch)
- [x] WhatsApp/Telegram share buttons ✅ DONE
- [ ] User wishlist functionality
- [ ] Email notification system
- [ ] Coupon expiry detection

### P1 (Important)
- [ ] Push notifications (Firebase)
- [ ] "Best time to buy" hints
- [ ] Fake coupon detection
- [ ] Better affiliate tracking

### P2 (Nice to Have)
- [ ] Deal Score AI ranking
- [ ] Price history charts
- [ ] User reviews/ratings
- [ ] Referral system

## Next Tasks
1. Add WhatsApp/Telegram viral sharing buttons
2. Implement user wishlist system
3. Add email capture popup for notifications
4. Enhance SEO with more dynamic pages
5. Add sitemap generation
