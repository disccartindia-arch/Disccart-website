# DISCCART - AI-Powered Coupon & Deals Platform

## Original Problem Statement
Build DISCCART - an AI-powered coupon and deals platform with React + FastAPI + MongoDB. Core features: deal listing, high-conversion coupon reveal UX, admin panel, smart affiliate engine, AI Deal Score, and fake coupon detection.

## Tech Stack
- **Frontend**: React 18 + Vite 5, TailwindCSS, Shadcn UI, Framer Motion
- **Backend**: FastAPI (Python), Motor (async MongoDB)
- **Database**: MongoDB
- **Auth**: JWT (Bearer token, role-based: admin/user)
- **Image Hosting**: Cloudinary
- **AI**: Emergent LLM Key (GPT-4o via emergentintegrations)
- **Analytics**: Google Analytics 4

## What's Implemented
- Phase 1-13: Core MVP (auth, deals, admin, wishlist, bulk mgmt, AI scores, stability)
- Phase 14: Dynamic filters, Cloudinary, Stores CRUD, Filter drawer
- Phase 15: Secure Auth (JWT roles), Homepage Slider, Dialog accessibility
- Phase 16: Hero section editor (admin-controlled background/text/colors)
- Phase 17: GrabOn-style upgrade — advanced filters, trending deals, stores, slider, FilterDrawer
- Phase 18: UX — Load More, Scroll-to-Top, Coupon filtering, Filter refresh fix
- Phase 19: Performance — In-memory TTL cache, parallel loading, skeletons
- Phase 20: Better Stack Monitoring — health endpoint, 5 monitors
- Phase 21: Popup System & Intro Animation
- Phase 22: Mobile UX + Like/Comment System + DealDetailModal
- Phase 23: AI Deal Assistant (DealBot) + Enhanced Smart Search
- Phase 24: Compact Deal Feed + Deal Finder Bar (April 29, 2026)
  - CompactDealCard: horizontal layout, 4-6 deals per mobile viewport
  - DealFinderBar: sticky filter bar (search, category, discount slider, price, sort)
  - DealsPage rewritten with compact cards + finder
  - Backend: /api/deals/filtered now supports search param
- Phase 25: Admin AI Upgrade (April 29, 2026)
  - AI Auto-Fill in Deals & Coupons form: single input → AI generates title, description, brand, category, prices
  - Bulk Mode: paste product names → AI generates all → approve/reject → bulk publish
  - Backend: POST /api/ai/generate-deal, POST /api/ai/generate-deals-bulk
  - AI Settings admin page (7 sections):
    1. Conversation Flow: sequential reply chain (editable prompts)
    2. Prompt Templates: greeting, recommendation, fallback, urgency, upsell, deal alert
    3. Category Tones: per-category tone selector (technical/trendy/urgent/friendly/luxury/budget)
    4. AI Personality: tone slider, length selector, aggressiveness, emoji toggle, promo intensity
    5. Engagement Hooks: re-engagement, exit intent, inactivity timer, deal alert prompt, personalized greeting
    6. Prime Membership: toggle, tier label, non-member teaser, member unlock, badge config (label/color/icon)
    7. Smart Notifications: alert frequency, wishlist suggestions, price drop message, limited stock message
  - Backend: GET/PATCH /api/admin/ai-settings (stored in site_settings collection)
  - Chatbot now reads AI settings dynamically for personality, tone, templates
  - Description field added to deal form
  - Schema-ready: membership_tier field architecture for users/deals (payment flow is future scope)
- Phase 25b: AI Error Handling + Image Uploads (April 29, 2026)
  - FIXED: DealBot fallback now shows specific error cause (missing key / budget / timeout) instead of generic message
  - FIXED: AI Auto-Fill shows actual backend error message instead of generic "AI generation failed"
  - Added: GET /api/ai/status endpoint — diagnose if AI key is configured on production
  - Backend no longer throws HTTP 500 when EMERGENT_LLM_KEY is missing — returns user-friendly error in response
  - Category Form: Cloudinary image upload (drag/drop + URL fallback)
  - Blog Form: Cloudinary cover image upload
  - NOTE: Production site (disccart.in) needs EMERGENT_LLM_KEY set in Render environment variables

## Key API Endpoints
- POST /api/auth/login, POST /api/auth/register, GET /api/auth/me
- GET /api/categories, POST/PUT/DELETE /api/categories
- GET /api/coupons (paginated), GET /api/coupons-only
- POST /api/upload-image (Cloudinary)
- GET /api/stores, GET /api/stores/featured, GET /api/stores/slug/{slug}
- GET /api/admin/filters, PATCH /api/admin/filters
- GET /api/deals/filtered (category, store, price, discount%, deal_type, search, sort_by)
- GET /api/deals/trending
- GET/PATCH /api/admin/trending-config
- GET /api/slides, GET/POST/PATCH/DELETE /api/admin/slides
- GET /api/hero-config, PATCH /api/admin/hero-config
- GET /api/popups, GET /api/popups/active, POST/PUT/DELETE /api/admin/popups/{id}
- POST /api/ai/chat (DealBot — reads AI settings)
- POST /api/ai/generate-deal (AI Auto-Fill)
- POST /api/ai/generate-deals-bulk (Bulk AI generation)
- GET /api/admin/ai-settings, PATCH /api/admin/ai-settings
- GET /api/search, GET /api/search/suggest
- POST /api/deals/{id}/like, POST /api/deals/{id}/comments
- CRUD: /api/pretty-links, /api/pages, /api/blog
- Wishlist: GET/POST/DELETE /api/wishlist/{user_id}

## DB Collections
- `coupons`: title, description, brand_name, category_name, code, affiliate_url, offer_type, image_url, original_price, discounted_price, discount_value, expires_at, is_active, clicks, deal_score, verification_status, created_at
- `categories`, `stores`, `filter_configs`, `homepage_slides`
- `site_settings`: {_id: "hero"|"trending"|"ai_settings", ...config}
- `users`: email, password_hash, role (admin|user)
- `popups`, `likes`, `comments`, `wishlists`, `clicks`, `pretty_links`, `pages`, `blog_posts`

## Backlog
- P1: Bulk CSV Deal Import (Admin panel drag-and-drop, column mapping)
- P1: Image Upload for Categories & Blogs (Cloudinary)
- P1: Facebook Pixel tracking (currently mocked)
- P2: Email capture popup for deal alerts
- P2: Push notifications (Firebase)
- P2: "Best time to buy" hint
- P2: Prime membership payment flow (schema ready)
- P3: AdminPage.jsx refactor (1850+ lines → sub-components)
- P3: server.py refactor (1900+ lines → modules)
- P3: Editor/Viewer role UI (backend RBAC ready)
