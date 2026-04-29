"""
Iteration 18 - Deal Finder Bar & Compact Cards Backend Tests
Tests the GET /api/deals/filtered endpoint with new 'search' query param
and verifies $or conflict resolution when both search and price filters active.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://coupon-hub-35.preview.emergentagent.com").rstrip("/")
ENDPOINT = f"{BASE_URL}/api/deals/filtered"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ===== Basic endpoint health =====
def test_filtered_deals_no_filters(session):
    r = session.get(ENDPOINT, params={"limit": 10})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "deals" in data
    assert isinstance(data["deals"], list)
    assert "total" in data


# ===== Search param =====
def test_filtered_deals_search_only(session):
    r = session.get(ENDPOINT, params={"search": "deal", "limit": 10})
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data.get("deals"), list)
    assert "total" in data


def test_filtered_deals_search_empty_string(session):
    # empty string should not crash, returns all
    r = session.get(ENDPOINT, params={"search": "", "limit": 5})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("deals"), list)


def test_filtered_deals_search_no_match(session):
    r = session.get(ENDPOINT, params={"search": "zzzzznonexistentxyz12345", "limit": 10})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("deals"), list)
    assert data["total"] == 0 or len(data["deals"]) == 0


# ===== Combined search + price ($or conflict avoidance) =====
def test_filtered_deals_search_with_price_range(session):
    """Critical: search uses $or; price filter also uses $or.
    Backend must combine via $and to avoid MongoDB conflicts."""
    r = session.get(
        ENDPOINT,
        params={"search": "a", "min_price": 100, "max_price": 50000, "limit": 10},
    )
    assert r.status_code == 200, f"Expected 200 but got {r.status_code}: {r.text}"
    data = r.json()
    assert isinstance(data.get("deals"), list)


def test_filtered_deals_search_with_min_price_only(session):
    r = session.get(ENDPOINT, params={"search": "deal", "min_price": 50, "limit": 10})
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data.get("deals"), list)


def test_filtered_deals_search_with_max_price_only(session):
    r = session.get(ENDPOINT, params={"search": "deal", "max_price": 99999, "limit": 10})
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data.get("deals"), list)


# ===== Sort options =====
@pytest.mark.parametrize("sort_by", ["newest", "popularity", "price_low", "price_high", "discount"])
def test_filtered_deals_sort_options(session, sort_by):
    r = session.get(ENDPOINT, params={"sort_by": sort_by, "limit": 10})
    assert r.status_code == 200, f"sort_by={sort_by} failed: {r.text}"
    data = r.json()
    assert isinstance(data.get("deals"), list)


def test_filtered_deals_sort_price_low_ordering(session):
    r = session.get(ENDPOINT, params={"sort_by": "price_low", "limit": 20})
    assert r.status_code == 200
    deals = r.json().get("deals", [])
    prices = [d.get("discounted_price") for d in deals if d.get("discounted_price")]
    if len(prices) >= 2:
        assert prices == sorted(prices), "price_low not sorted ascending"


# ===== Min discount filter =====
def test_filtered_deals_min_discount(session):
    r = session.get(ENDPOINT, params={"min_discount": 30, "limit": 20})
    assert r.status_code == 200
    deals = r.json().get("deals", [])
    for d in deals:
        if d.get("discount_value") is not None:
            assert d["discount_value"] >= 30, f"Deal discount {d['discount_value']} < 30"


# ===== Category filter =====
def test_filtered_deals_with_category(session):
    # Get a category first
    cat_resp = session.get(f"{BASE_URL}/api/categories")
    if cat_resp.status_code != 200:
        pytest.skip("Categories endpoint unavailable")
    cats = cat_resp.json()
    if not cats:
        pytest.skip("No categories in DB")
    cat_name = cats[0].get("name")
    r = session.get(ENDPOINT, params={"category": cat_name, "limit": 10})
    assert r.status_code == 200, r.text


# ===== Combined complex filter =====
def test_filtered_deals_all_filters_combined(session):
    r = session.get(
        ENDPOINT,
        params={
            "search": "a",
            "min_discount": 10,
            "min_price": 100,
            "max_price": 100000,
            "sort_by": "discount",
            "limit": 10,
        },
    )
    assert r.status_code == 200, f"Combined filters failed: {r.text}"
    data = r.json()
    assert "deals" in data
    assert "total" in data


# ===== Pagination =====
def test_filtered_deals_pagination(session):
    r1 = session.get(ENDPOINT, params={"limit": 5, "skip": 0})
    r2 = session.get(ENDPOINT, params={"limit": 5, "skip": 5})
    assert r1.status_code == 200 and r2.status_code == 200
    d1 = r1.json().get("deals", [])
    d2 = r2.json().get("deals", [])
    if d1 and d2:
        ids1 = {d.get("id") for d in d1}
        ids2 = {d.get("id") for d in d2}
        assert ids1.isdisjoint(ids2), "Pagination returned overlapping deals"


# ===== Categories endpoint (used by DealFinderBar) =====
def test_categories_endpoint(session):
    r = session.get(f"{BASE_URL}/api/categories")
    assert r.status_code == 200
    cats = r.json()
    assert isinstance(cats, list)
