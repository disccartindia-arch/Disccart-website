# DISCCART - AI-Powered Coupon & Deals Platform

## Original Problem Statement
Build DISCCART - an AI-powered coupon and deals platform with React + FastAPI + MongoDB. Core features: deal listing, high-conversion coupon reveal UX, admin panel, smart affiliate engine, AI Deal Score, and fake coupon detection.

## Tech Stack
- **Frontend**: React 18 + Vite 5, TailwindCSS, Shadcn UI, Framer Motion
- **Backend**: FastAPI (Python), Motor (async MongoDB)
- **Database**: MongoDB
- **Auth**: JWT (Bearer token, role-based: admin/user)
- **Image Hosting**: Cloudinary
- **Analytics**: Google Analytics 4

## What's Implemented
- Phase 1-13: Core MVP (auth, deals, admin, wishlist, bulk mgmt, AI scores, stability)
- Phase 14: Dynamic filters, Cloudinary, Stores CRUD, Filter drawer
- Phase 15: Secure Auth (JWT roles), Homepage Slider, Dialog accessibility
- Phase 16: Hero section editor (admin-controlled background/text/colors)
- Phase 17: GrabOn-style upgrade (April 10, 2026)
  - Advanced filter system: price brackets + discount filters + deal type filters (all with add/edit/delete/enable/disable/reorder)
  - Trending deals (24hr window logic + admin config for duration/toggle)
  - Stores upgrade: slug, description, website_url, category, featured, store_of_month, display_order, logo upload
  - Store pages: /stores listing (search, featured, store of month) + /stores/:slug detail with deals
  - Slider upgrade: title, subtitle, btn_text, btn_link, bg_color, swipe support
  - FilterDrawer: discount % filters, deal type filters
  - Admin: Site Settings tab (trending config), upgraded Filter Settings, upgraded Store form, upgraded Slide form
  - Header nav: Stores link added
- Phase 18: UX Improvements (April 10, 2026)
  - Load More Pagination: /api/coupons returns {deals, total, page, has_more}; HomePage shows "Load More Deals" button
  - Scroll-to-Top Button: Floating button (vertically centered right side), appears after 300px scroll
  - Coupon Page Filtering Fix: /api/coupons-only now only returns deals with non-null/non-empty code field
  - Filter Refresh Bug Fix: DealsPage clears cached data, shows loading, handles race conditions via filterVersion ref

## Key API Endpoints
- POST /api/auth/login, POST /api/auth/register, GET /api/auth/me
- GET /api/categories, POST/PUT/DELETE /api/categories
- GET /api/coupons (paginated: returns {deals, total, page, has_more})
- GET /api/coupons-only (code-only deals, array response)
- POST /api/upload-image (Cloudinary)
- GET /api/stores, GET /api/stores/featured, GET /api/stores/slug/{slug}, POST/PUT/DELETE /api/stores
- GET /api/admin/filters, PATCH /api/admin/filters (price/discount/deal-type/category/store)
- GET /api/deals/filtered (category, store, price, discount%, deal_type, sort)
- GET /api/deals/trending (24hr window)
- GET/PATCH /api/admin/trending-config
- GET /api/slides, GET/POST/PATCH/DELETE /api/admin/slides
- GET /api/hero-config, PATCH /api/admin/hero-config
- CRUD: /api/pretty-links, /api/pages, /api/blog
- Wishlist: GET/POST/DELETE /api/wishlist/{user_id}

## DB Collections
- `coupons`: {title, brand_name, category_name, code, affiliate_url, offer_type, image_url, original_price (int), discounted_price (int), discount_value, expires_at, is_active, clicks, created_at}
- `categories`: {name, slug, icon, image_url, background_image_url, show_in_filter, display_order}
- `stores`: {name, slug, logo_url, description, website_url, category, show_in_filter, is_active, is_featured, is_store_of_month, display_order}
- `filter_configs`: {_id: "global", price_brackets, discount_filters, deal_type_filters}
- `homepage_slides`: {image_url, title, subtitle, btn_text, btn_link, bg_color, redirect_url, is_active, order}
- `site_settings`: {_id: "hero"|"trending", ...config}
- `users`: {email, password_hash, role (admin|user)}
- `wishlists`, `clicks`, `pretty_links`, `pages`, `blog_posts`

## Backlog
- P1: Facebook Pixel tracking
- P2: Email capture popup
- P2: Push notifications (Firebase)
- P2: "Best time to buy" hint
- P3: Editor/Viewer role UI (backend RBAC ready)
