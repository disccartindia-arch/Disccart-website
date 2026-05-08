"""Backend tests for Deal Engine MVP v2 (iteration 21).

Covers NEW endpoints/behaviour:
- POST /api/deal-engine/test-telegram  — connection test
- POST /api/deal-engine/queue          — batch URL processing
- AI fallback when scraping fails (Amazon URL returns title/prices)
- GET  /api/deal-engine/settings       — telegram token must be MASKED
- Auth guards (401) on the new endpoints
- Settings save persistence after reload pattern
"""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://coupon-hub-35.preview.emergentagent.com"
).rstrip("/")
ADMIN_EMAIL = "disccartindia@gmail.com"
ADMIN_PASS = "Admin@2026@"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth guards on new endpoints ----------
def test_test_telegram_unauthenticated():
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/test-telegram",
        json={"bot_token": "x", "channel_id": "y"},
        timeout=10,
    )
    assert r.status_code == 401


def test_queue_unauthenticated():
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/queue",
        json={"urls": ["https://www.amazon.in/dp/B0CHX3QBCH"]},
        timeout=10,
    )
    assert r.status_code == 401


# ---------- /test-telegram ----------
def test_test_telegram_missing_token(headers):
    """If both body and saved settings are empty, expect success=false with error."""
    # First clear settings
    requests.patch(
        f"{BASE_URL}/api/deal-engine/settings",
        headers=headers,
        json={"telegram_bot_token": "", "telegram_channel_id": ""},
        timeout=15,
    )
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/test-telegram",
        headers=headers,
        json={"bot_token": "", "channel_id": ""},
        timeout=15,
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is False
    assert "token" in (data.get("error") or "").lower()


def test_test_telegram_invalid_token(headers):
    """Provide a fake token — must return success=false with helpful error."""
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/test-telegram",
        headers=headers,
        json={"bot_token": "1234567890:INVALIDTOKEN_FAKE_FOR_TESTING_xx", "channel_id": "@disccart"},
        timeout=20,
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is False
    assert "error" in data
    # Error should mention bot/token issue
    err = (data.get("error") or "").lower()
    assert any(k in err for k in ["bot", "token", "unauthorized", "invalid"])


# ---------- Settings: token masking ----------
def test_settings_masks_telegram_token(headers):
    """Save a fake long token and confirm GET masks it."""
    fake_token = "9999999999:AAFAKEbottokenForMaskingTesting1234567890"
    r = requests.patch(
        f"{BASE_URL}/api/deal-engine/settings",
        headers=headers,
        json={"telegram_bot_token": fake_token, "telegram_channel_id": "@testchan"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json().get("status") == "saved"

    r2 = requests.get(f"{BASE_URL}/api/deal-engine/settings", headers=headers, timeout=15)
    assert r2.status_code == 200
    s = r2.json()
    # Token should be masked, not raw
    assert s.get("telegram_bot_token") != fake_token, "Raw token leaked!"
    assert "..." in (s.get("telegram_bot_token") or ""), f"Token not masked properly: {s.get('telegram_bot_token')}"
    assert s.get("telegram_configured") is True
    assert s.get("telegram_channel_id") == "@testchan"

    # Cleanup: clear token so other tests aren't affected
    requests.patch(
        f"{BASE_URL}/api/deal-engine/settings",
        headers=headers,
        json={"telegram_bot_token": "", "telegram_channel_id": ""},
        timeout=15,
    )


def test_settings_telegram_configured_false_when_empty(headers):
    requests.patch(
        f"{BASE_URL}/api/deal-engine/settings",
        headers=headers,
        json={"telegram_bot_token": "", "telegram_channel_id": ""},
        timeout=15,
    )
    r = requests.get(f"{BASE_URL}/api/deal-engine/settings", headers=headers, timeout=15)
    assert r.status_code == 200
    s = r.json()
    assert s.get("telegram_configured") is False


# ---------- AI extraction fallback ----------
def test_extract_amazon_returns_title_via_ai_or_scraping(headers):
    """Amazon blocks server requests — AI fallback must produce a non-empty title and prices."""
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/extract",
        headers=headers,
        json={"url": "https://www.amazon.in/dp/B0CHX3QBCH"},
        timeout=60,  # AI takes 5-8s
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True
    p = data["product"]
    assert p["platform"] == "amazon"
    assert "affiliate_url" in p
    # AI should fill these in even when scraping is blocked
    assert isinstance(p.get("title"), str)
    assert len(p["title"]) > 5, f"Title too short or empty: '{p.get('title')}'"
    assert isinstance(p.get("current_price"), int)
    assert isinstance(p.get("original_price"), int)
    # extraction_method should be either "scraping" or "ai"
    method = p.get("extraction_method", "")
    assert method in ("ai", "scraping", ""), f"Unexpected extraction_method: {method}"


# ---------- /queue batch processing ----------
def test_queue_requires_urls_array(headers):
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/queue",
        headers=headers,
        json={},
        timeout=15,
    )
    assert r.status_code == 400


def test_queue_requires_urls_to_be_list(headers):
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/queue",
        headers=headers,
        json={"urls": "not_a_list"},
        timeout=15,
    )
    assert r.status_code == 400


def test_queue_processes_two_urls(headers):
    """Queue should process 2 URLs and return product+caption for each (~15s)."""
    payload = {
        "urls": [
            "https://www.amazon.in/dp/B0CHX3QBCH",
            "https://www.amazon.in/dp/B08N5WRWNW",
        ]
    }
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/queue",
        headers=headers,
        json=payload,
        timeout=120,  # AI takes time per URL
    )
    assert r.status_code == 200, f"Queue failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert "results" in data
    assert "total" in data
    assert data["total"] == 2
    assert len(data["results"]) == 2

    for item in data["results"]:
        assert "url" in item
        assert "success" in item
        assert "product" in item or "error" in item
        if item.get("success"):
            p = item["product"]
            assert p.get("platform") == "amazon"
            assert "affiliate_url" in p
            assert isinstance(p.get("title"), str) and len(p["title"]) > 0
            # Captions should also be present for successful items
            assert "captions" in item
            caps = item["captions"]
            if caps:  # caption may be empty if api_key missing — but we expect it set
                assert "telegram_caption" in caps or "fallback" in caps


def test_queue_skips_empty_strings(headers):
    """Empty/whitespace urls in array should be skipped."""
    r = requests.post(
        f"{BASE_URL}/api/deal-engine/queue",
        headers=headers,
        json={"urls": ["   ", "", "https://www.amazon.in/dp/B08N5WRWNW"]},
        timeout=60,
    )
    assert r.status_code == 200
    data = r.json()
    # Only the non-empty url should produce a result
    assert data["total"] == 1


# ---------- Settings persistence after reload (simulated) ----------
def test_settings_save_persists_across_calls(headers):
    payload = {
        "amazon_affiliate_tag": "persisttest-21",
        "flipkart_affiliate_id": "persistflp-21",
    }
    r = requests.patch(
        f"{BASE_URL}/api/deal-engine/settings", headers=headers, json=payload, timeout=15
    )
    assert r.status_code == 200

    # Simulate page reload — fresh GET
    r2 = requests.get(f"{BASE_URL}/api/deal-engine/settings", headers=headers, timeout=15)
    assert r2.status_code == 200
    s = r2.json()
    assert s.get("amazon_affiliate_tag") == "persisttest-21"
    assert s.get("flipkart_affiliate_id") == "persistflp-21"
