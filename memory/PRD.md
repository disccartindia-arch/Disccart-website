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
- Phase 19: Performance Optimization (April 10, 2026)
  - Backend In-Memory TTL Cache: MemoryCache class with deals (5min), stores (30min), categories (1hr) TTLs
  - Cache auto-invalidation on all admin mutations (create/update/delete coupons, categories, stores, slides, hero, trending config)
  - Categories endpoint optimized: N+1 queries → single aggregation pipeline
  - Cache-Control headers: public APIs get `s-maxage=60, stale-while-revalidate=300`; admin APIs get `no-cache, no-store`
  - Independent section loading: HomePage sections (featured, trending, categories, limited, hero) load in parallel with own loading states
  - Skeleton Loading UI: DealCardSkeleton, StoreCardSkeleton, CouponCardSkeleton, CategoryCardSkeleton components
  - FilterDrawer preserved on HomePage
- Phase 20: Better Stack Monitoring (April 10, 2026)
  - Added /api/health endpoint (status, DB connectivity, cache entries, timestamp)
  - 5 Better Stack monitors created
- Phase 21: Popup System & Intro Animation (April 10, 2026)
  - IntroAnimation: 2-3s cart logo animation, sessionStorage-based (once per visit)
  - Smart PopupManager: 7 popup types, 5 trigger types, 5 animation styles
  - Backend: Full popup CRUD + analytics (views, clicks) tracking
  - Admin Popups tab: create/edit/delete/toggle/preview with targeting, scheduling, media upload, analytics display
- Phase 22: Mobile UX Fixes + Like/Comment System (April 21, 2026)
  - Admin Panel: Tabs reorganized in 2-column grid for proper mobile layout
  - FilterDrawer: Apply button sticky above bottom nav
  - Verification Badge: Added verification_status dropdown + deal_score input to admin deal edit form
  - Like System: Anyone can like deals (visitor ID from localStorage for non-logged users)
  - Comment System: Only logged-in users can comment
  - DealDetailModal: Full deal detail popup with image, pricing, code, verification, like button, comments section
- Phase 23: AI Deal Assistant + Enhanced Search (April 21, 2026)
  - AI DealBot: Floating chat widget with GPT-4o (via Emergent LLM key)
  - Synonym expansion engine: 18+ synonym groups
  - Enhanced Search: GET /api/search with fuzzy matching + filters + sort options
  - Search Autocomplete: GET /api/search/suggest
  - SmartSearchBar: Replaced old search in Header with autocomplete dropdown
  - SearchPage: Full results page with sort dropdown, keyword tags, skeleton loading
- Phase 24: Compact Feed + Deal Finder (April 29, 2026)
  - CompactDealCard: Horizontal layout (~100px height), thumbnail left, info center, CTA right
  - Mobile shows 4-6 deals per viewport (vs 1 before)
  - DealFinderBar: Sticky filter bar above deal feed with search (300ms debounce), category dropdown, discount % slider (0-90%), min/max price inputs, sort selector, reset button, collapsible on mobile
  - DealsPage rewritten to use CompactDealCard + DealFinderBar (removed old FilterDrawer dependency)
  - HomePage mobile uses CompactDealCard for featured/trending/limited sections
  - HomePage desktop still uses full DealCard grid
  - Backend: /api/deals/filtered now supports `search` param with $and/$or conflict resolution
  - Backend: Deterministic pagination with _id as secondary sort key
  - All affiliate tracking preserved (CouponRevealModal + analytics events intact)
  - All routing preserved (no URL structure changes)

## Key API Endpoints
- POST /api/auth/login, POST /api/auth/register, GET /api/auth/me
- GET /api/categories, POST/PUT/DELETE /api/categories
- GET /api/coupons (paginated: returns {deals, total, page, has_more})
- GET /api/coupons-only (code-only deals, array response)
- POST /api/upload-image (Cloudinary)
- GET /api/stores, GET /api/stores/featured, GET /api/stores/slug/{slug}, POST/PUT/DELETE /api/stores
- GET /api/admin/filters, PATCH /api/admin/filters (price/discount/deal-type/category/store)
- GET /api/deals/filtered (category, store, price, discount%, deal_type, search, sort_by)
- GET /api/deals/trending (24hr window)
- GET/PATCH /api/admin/trending-config
- GET /api/slides, GET/POST/PATCH/DELETE /api/admin/slides
- GET /api/hero-config, PATCH /api/admin/hero-config
- GET /api/popups, GET /api/popups/active, POST/PUT/DELETE /api/admin/popups/{id}
- POST /api/popups/{id}/view, POST /api/popups/{id}/click
- POST /api/ai/chat (AI Deal Assistant)
- GET /api/search (Enhanced search with filters, sort, pagination)
- GET /api/search/suggest (Autocomplete suggestions)
- POST /api/deals/{id}/like, GET /api/deals/{id}/likes
- POST /api/deals/{id}/comments, GET /api/deals/{id}/comments
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
- `popups`: {title, description, cta_text, cta_link, image_url, video_url, popup_type, trigger, scroll_percent, delay_seconds, target_pages[], target_devices[], animation_style, is_active, frequency, start_date, end_date, priority, views, clicks}
- `likes`: {deal_id, user_id, created_at}
- `comments`: {deal_id, user_id, user_name, text, created_at}

## Backlog
- P1: Bulk CSV Deal Import (Admin panel drag-and-drop, column mapping, backend insertMany)
- P1: Image Upload for Categories & Blogs (Cloudinary)
- P1: Facebook Pixel tracking (currently mocked)
- P2: Email capture popup for deal alerts
- P2: Push notifications (Firebase)
- P2: "Best time to buy" hint
- P3: AdminPage.jsx refactor (split 1650+ lines into sub-components)
- P3: Editor/Viewer role UI (backend RBAC ready)
