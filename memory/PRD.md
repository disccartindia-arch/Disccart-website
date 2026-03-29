# DISCCART - AI-Powered Coupon & Deals Platform

## Original Problem Statement
Build DISCCART – an AI-powered coupon and deals platform. Scalable startup platform with React + FastAPI + MongoDB. Core features: deal listing, high-conversion coupon reveal UX (auto-copy, countdown timer), admin panel, SEO pages, smart affiliate engine (pretty links).

## User Personas
- **Shoppers**: Looking for verified coupons, promo codes, and deals across Indian e-commerce brands
- **Admin**: Platform owner managing deals, categories, blog content, static pages, and affiliate links
- **Affiliate Partners**: Brands whose deals are featured via pretty links

## Core Requirements
- Fast, modern UI (Tailwind + Shadcn), responsive design
- Admin control panel for deal management
- SEO optimization (meta tags, sitemaps, dynamic pages)
- Google Analytics integration
- CMS for blog, static pages, categories
- Pretty Links URL shortener for affiliate tracking

## Tech Stack
- **Frontend**: React.js, TailwindCSS, Shadcn UI, Framer Motion, React Helmet Async, React Markdown
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **Auth**: JWT (httpOnly cookies, access + refresh tokens)
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key (deal content generation)
- **Analytics**: Google Analytics 4 (G-Y5T6ECMHE2)

## What's Implemented (as of March 29, 2026)

### Phase 1 - MVP (DONE)
- JWT Authentication with brute-force protection
- Deal/Coupon CRUD with deal scoring
- Categories and Brands
- Coupon Reveal Modal with auto-copy
- Social Media Share Buttons (WhatsApp, Telegram, Instagram)
- Homepage with featured deals, category pills
- Search, Category, Trending pages

### Phase 2 - SEO & Analytics (DONE)
- XML Sitemap generation
- Robots.txt
- Dynamic meta tags via React Helmet Async
- Google Analytics 4 integration
- SEO-optimized pages for brands/categories
- Security Headers & Rate Limiting

### Phase 3 - CMS & Admin Overhaul (DONE)
- Admin Panel with 7 tabs: Dashboard, Deals, Categories, Pretty Links, Pages, Blog, CSV Upload
- Pretty Links URL shortener with click tracking
- Static Pages CMS (Privacy Policy, Terms & Conditions, About Us, Contact Us)
- Blog system with Markdown content, categories, view tracking
- Footer with links to all static pages
- Deals page and Limited Time Deals page with countdown timers
- CSV bulk upload for coupons
- AI content generation for deals

## Database Collections
- `users`: {email, password_hash, name, role, created_at}
- `coupons`: {title, description, code, discount_type, discount_value, brand_name, category_name, affiliate_url, image_url, expires_at, is_featured, is_verified, is_active, tags, clicks, deal_score, created_at}
- `categories`: {name, slug, icon, image_url, description}
- `pages`: {slug, title, content, meta_description, meta_keywords, is_published, created_at, updated_at}
- `blog_posts`: {slug, title, excerpt, content, featured_image, category, tags, meta_description, is_published, views, created_at, updated_at}
- `pretty_links`: {slug, destination_url, title, description, is_active, clicks, created_at, last_clicked}
- `clicks`: {coupon_id, source, ip, user_agent, created_at}
- `link_clicks`: {link_id, slug, ip, user_agent, referer, created_at}

## API Endpoints
### Auth: POST /api/auth/login, /register, /logout, /refresh | GET /api/auth/me
### Coupons: GET/POST /api/coupons | GET/PUT/DELETE /api/coupons/:id | POST /api/coupons/bulk-upload
### Categories: GET/POST /api/categories | GET/PUT/DELETE /api/categories/:id
### Pages: GET /api/pages | GET /api/pages/:slug | POST/PUT/DELETE (admin)
### Blog: GET /api/blog | GET /api/blog/:slug | POST/PUT/DELETE (admin)
### Pretty Links: GET/POST /api/pretty-links | PUT/DELETE /api/pretty-links/:id | GET /api/go/:slug (redirect)
### Analytics: GET /api/analytics/overview | GET /api/analytics/clicks
### SEO: GET /api/seo/:page_type | GET /api/seo/meta/:page_type
### AI: POST /api/ai/generate-content

## Backlog (Prioritized)
### P1
- Facebook Pixel tracking (actual implementation, currently placeholder)

### P2
- User wishlist system
- "Deal Score" AI-based ranking & Fake coupon detection
- Email capture popup for deal alerts
- Push notifications (Firebase)
- "Best time to buy" hints

## Admin Credentials
- Email: disccartindia@gmail.com
- Password: Admin@2026@
