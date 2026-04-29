"""Backend tests for AI Auto-Fill, Bulk Mode, and AI Settings (iteration 19)"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://coupon-hub-35.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "disccartindia@gmail.com"
ADMIN_PASS = "Admin@2026@"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Health ----------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------- AI Settings GET/PATCH ----------
def test_get_ai_settings(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/ai-settings", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)


def test_ai_settings_unauthenticated():
    r = requests.get(f"{BASE_URL}/api/admin/ai-settings", timeout=10)
    assert r.status_code == 401


def test_patch_and_persist_ai_settings(admin_headers):
    payload = {
        "personality": {"tone": 75, "length": "short", "aggressiveness": "balanced", "emoji_usage": True, "promo_intensity": 60},
        "reply_chain": [{"stage": "greeting", "text": "Hi!"}, {"stage": "ask_need", "text": "What do you want?"}],
        "category_tones": {"Electronics": "professional", "Fashion": "trendy"},
        "engagement": {"personalized_greeting": True, "scarcity": True},
        "prompt_templates": {"greeting": "Hello shopper!", "fallback": "Try other categories."},
        "prime_membership": {"enabled": True, "tier_label": "Prime Member Deal", "badge_color": "#ee922c"},
        "notifications": {"email": True, "push": False},
    }
    r = requests.patch(f"{BASE_URL}/api/admin/ai-settings", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "saved"

    # Verify persistence
    r2 = requests.get(f"{BASE_URL}/api/admin/ai-settings", headers=admin_headers, timeout=15)
    assert r2.status_code == 200
    data = r2.json()
    assert data["personality"]["tone"] == 75
    assert data["personality"]["length"] == "short"
    assert data["prime_membership"]["enabled"] is True
    assert len(data["reply_chain"]) == 2
    assert data["category_tones"]["Electronics"] == "professional"


# ---------- AI Generate Deal ----------
def test_generate_deal_unauthenticated():
    r = requests.post(f"{BASE_URL}/api/ai/generate-deal", json={"query": "iPhone case"}, timeout=15)
    assert r.status_code == 401


def test_generate_deal_missing_query(admin_headers):
    r = requests.post(f"{BASE_URL}/api/ai/generate-deal", json={"query": ""}, headers=admin_headers, timeout=15)
    assert r.status_code == 400


def test_generate_deal_success(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/ai/generate-deal",
        json={"query": "iPhone case"},
        headers=admin_headers,
        timeout=60,
    )
    assert r.status_code == 200, f"Status {r.status_code}: {r.text[:300]}"
    data = r.json()
    # Endpoint returns {success, deal}
    assert data.get("success") is True, f"AI gen failed: {data}"
    deal = data.get("deal", {})
    assert "title" in deal, f"Missing title: {list(deal.keys())}"
    assert "category_name" in deal
    assert "original_price" in deal
    assert "discounted_price" in deal
    assert isinstance(deal.get("original_price"), (int, float))


# ---------- AI Generate Deals Bulk ----------
def test_generate_deals_bulk_unauthenticated():
    r = requests.post(f"{BASE_URL}/api/ai/generate-deals-bulk", json={"queries": ["iPhone case"]}, timeout=10)
    assert r.status_code == 401


def test_generate_deals_bulk_invalid(admin_headers):
    r = requests.post(f"{BASE_URL}/api/ai/generate-deals-bulk", json={"queries": []}, headers=admin_headers, timeout=15)
    assert r.status_code == 400


def test_generate_deals_bulk_success(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/ai/generate-deals-bulk",
        json={"queries": ["iPhone case", "Bluetooth speaker"]},
        headers=admin_headers,
        timeout=120,
    )
    assert r.status_code == 200, f"Status {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "results" in data
    assert isinstance(data["results"], list)
    assert len(data["results"]) == 2
    # at least one item should have a 'success' field
    for item in data["results"]:
        assert "query" in item
        assert "success" in item


# ---------- Regression: existing deals/coupons CRUD still works ----------
def test_coupons_list():
    r = requests.get(f"{BASE_URL}/api/coupons?limit=5", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "deals" in data


def test_categories_list():
    r = requests.get(f"{BASE_URL}/api/categories", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_and_delete_coupon_regression():
    # login admin
    tok = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    payload = {
        "title": "TEST_Regression Deal",
        "brand_name": "TestBrand",
        "category_name": "Electronics",
        "affiliate_url": "https://example.com/test",
        "original_price": 1000,
        "discounted_price": 500,
        "discount_type": "percentage",
        "discount_value": 50,
        "is_active": True,
    }
    r = requests.post(f"{BASE_URL}/api/coupons", json=payload, headers=h, timeout=15)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    # delete
    r2 = requests.delete(f"{BASE_URL}/api/coupons/{cid}", headers=h, timeout=15)
    assert r2.status_code == 200


# ---------- AI chat reads settings ----------
def test_ai_chat_works():
    r = requests.post(f"{BASE_URL}/api/ai/chat", json={"message": "show me phone deals"}, timeout=60)
    assert r.status_code == 200
    data = r.json()
    assert "reply" in data
    assert "products" in data
