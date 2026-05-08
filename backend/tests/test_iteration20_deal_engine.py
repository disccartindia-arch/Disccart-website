"""Backend tests for Deal Engine MVP (iteration 20).

Covers: extract, caption, publish-website, deals listing, status update,
analytics, settings GET/PATCH, telegram-not-configured, auth checks.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://coupon-hub-35.preview.emergentagent.com"
).rstrip("/")
ADMIN_EMAIL = "disccartindia@gmail.com"
ADMIN_PASS = "Admin@2026@"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def created_deal_id(headers):
    """Create a deal once for this module so other tests can use it."""
    payload = {
        "title": "TEST_DealEngine Sample Wireless Earbuds",
        "description": "Auto-test deal for deal engine.",
        "brand_name": "TestBrand",
        "category_name": "Electronics",
        "affiliate_url": "https://www.amazon.in/dp/B0TESTSKU?tag=testtag-21",
        "image_url": "https://m.media-amazon.com/images/I/test.jpg",
        "original_price": 2999,
        "discounted_price": 999,
        "discount_pct": 67,
        "platform": "amazon",
        "source_url": "https://www.amazon.in/dp/B0TESTSKU",
        "status": "draft",
    }
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/publish-website",
        headers=headers,
        json=payload,
        timeout=20,
    )
    assert r.status_code == 200, f"publish-website failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True
    assert "deal_id" in data and isinstance(data["deal_id"], str)
    assert "slug" in data and len(data["slug"]) > 0
    return data["deal_id"]


# ---------- Health ----------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200


# ---------- Auth Guards ----------
def test_extract_unauthenticated():
    r = requests.post(f"{BASE_URL}/api/deal-engine/extract", json={"url": "https://www.amazon.in/dp/X"}, timeout=10)
    assert r.status_code == 401


def test_settings_unauthenticated():
    r = requests.get(f"{BASE_URL}/api/deal-engine/settings", timeout=10)
    assert r.status_code == 401


def test_analytics_unauthenticated():
    r = requests.get(f"{BASE_URL}/api/deal-engine/analytics", timeout=10)
    assert r.status_code == 401


# ---------- Extract ----------
def test_extract_missing_url(headers):
    r = requests.post(f"{BASE_URL}/api/deal-engine/extract", headers=headers, json={}, timeout=20)
    assert r.status_code == 400


def test_extract_unknown_platform(headers):
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/extract",
        headers=headers,
        json={"url": "https://example.com/product/123"},
        timeout=30,
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True
    p = data["product"]
    assert p["platform"] == "unknown"
    # extraction_note should hint manual fill
    assert "extraction_note" in p or p.get("error")
    # Affiliate url passthrough for unknown
    assert "affiliate_url" in p


def test_extract_amazon_url(headers):
    """Amazon may block bots. We assert endpoint returns proper structure regardless."""
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/extract",
        headers=headers,
        json={"url": "https://www.amazon.in/dp/B08N5WRWNW"},
        timeout=30,
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True
    p = data["product"]
    assert p["platform"] == "amazon"
    assert "affiliate_url" in p
    assert "title" in p and "current_price" in p


# ---------- Settings GET/PATCH ----------
def test_get_settings(headers):
    r = requests.get(f"{BASE_URL}/api/deal-engine/settings", headers=headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


def test_patch_settings_persist(headers):
    payload = {
        "amazon_affiliate_tag": "testaffil-21",
        "flipkart_affiliate_id": "testflp01",
        "telegram_bot_token": "",  # leave empty so telegram tests verify "not configured"
        "telegram_channel_id": "",
    }
    r = requests.patch(
        f"{BASE_URL}/api/deal-engine/settings",
        headers=headers,
        json=payload,
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json().get("status") == "saved"

    # Verify GET returns saved values
    r2 = requests.get(f"{BASE_URL}/api/deal-engine/settings", headers=headers, timeout=15)
    assert r2.status_code == 200
    s = r2.json()
    assert s.get("amazon_affiliate_tag") == "testaffil-21"
    assert s.get("flipkart_affiliate_id") == "testflp01"


def test_extract_amazon_applies_affiliate_tag(headers):
    """After saving amazon tag, extract should append ?tag=... to affiliate_url."""
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/extract",
        headers=headers,
        json={"url": "https://www.amazon.in/dp/B08N5WRWNW"},
        timeout=30,
    )
    assert r.status_code == 200
    p = r.json()["product"]
    assert "tag=testaffil-21" in p.get("affiliate_url", ""), f"Got: {p.get('affiliate_url')}"


# ---------- Caption ----------
def test_caption_requires_title(headers):
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/caption",
        headers=headers,
        json={"product": {}},
        timeout=15,
    )
    assert r.status_code == 400


def test_caption_generates(headers):
    product = {
        "title": "Sony WH-1000XM4 Wireless Headphones",
        "current_price": 19990,
        "original_price": 29990,
        "discount_pct": 33,
        "platform": "amazon",
        "features": ["Industry-leading noise cancellation", "30 hr battery"],
    }
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/caption",
        headers=headers,
        json={"product": product},
        timeout=60,
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True
    caps = data["captions"]
    assert "telegram_caption" in caps
    assert "website_description" in caps
    assert "seo_title" in caps
    assert isinstance(caps["telegram_caption"], str) and len(caps["telegram_caption"]) > 0


# ---------- Publish website (covered by fixture) + persistence ----------
def test_publish_website_requires_title(headers):
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/publish-website",
        headers=headers,
        json={"description": "no title"},
        timeout=15,
    )
    assert r.status_code == 400


def test_deal_persisted_in_listing(headers, created_deal_id):
    # Listing returns the created deal
    r = requests.get(
        f"{BASE_URL}/api/deal-engine/deals?status=draft&limit=50",
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert "deals" in body and "total" in body
    ids = [d["id"] for d in body["deals"]]
    assert created_deal_id in ids
    # No mongo _id leakage
    for d in body["deals"]:
        assert "_id" not in d
    # Validate one row has expected fields
    found = next(d for d in body["deals"] if d["id"] == created_deal_id)
    assert found["status"] == "draft"
    assert found["title"].startswith("TEST_DealEngine")


# ---------- Status update + persistence ----------
def test_update_status_invalid(headers, created_deal_id):
    r = requests.patch(
        f"{BASE_URL}/api/deal-engine/deals/{created_deal_id}/status",
        headers=headers,
        json={"status": "garbage"},
        timeout=15,
    )
    assert r.status_code == 400


def test_update_status_publish_and_verify(headers, created_deal_id):
    r = requests.patch(
        f"{BASE_URL}/api/deal-engine/deals/{created_deal_id}/status",
        headers=headers,
        json={"status": "published"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json().get("success") is True

    # Verify via listing
    r2 = requests.get(
        f"{BASE_URL}/api/deal-engine/deals?status=published&limit=100",
        headers=headers,
        timeout=15,
    )
    assert r2.status_code == 200
    deals = r2.json()["deals"]
    found = [d for d in deals if d["id"] == created_deal_id]
    assert found, "Updated deal not found in published list"
    assert found[0]["status"] == "published"


# ---------- Analytics ----------
def test_analytics_returns_counts(headers, created_deal_id):
    r = requests.get(f"{BASE_URL}/api/deal-engine/analytics", headers=headers, timeout=15)
    assert r.status_code == 200
    a = r.json()
    for key in ["total_deals_posted", "total_telegram_posts", "published", "drafts", "scheduled"]:
        assert key in a, f"Missing analytics key: {key}"
    assert isinstance(a["published"], int)
    assert a["published"] >= 1  # we just published one


# ---------- Telegram not configured ----------
def test_telegram_not_configured(headers):
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/publish-telegram",
        headers=headers,
        json={"caption": "hi", "affiliate_url": "https://x.com"},
        timeout=15,
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is False
    assert "not configured" in (data.get("error") or "").lower()


# ---------- Cleanup ----------
def test_cleanup_delete_test_deal(headers, created_deal_id):
    """Best-effort delete via existing admin coupon endpoints if available."""
    # Try delete via /api/admin/coupons/{id}
    r = requests.delete(
        f"{BASE_URL}/api/admin/coupons/{created_deal_id}",
        headers=headers,
        timeout=15,
    )
    # Accept 200/204/404 (route may differ; cleanup is best-effort)
    assert r.status_code in (200, 204, 404, 405)
