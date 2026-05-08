"""
Deal Engine — URL resolution, product extraction (multi-layer), AI caption generation,
affiliate tagging, Telegram publishing.
"""

import httpx
import re
import os
import json
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

logger = logging.getLogger(__name__)

# ===================== URL RESOLUTION & NORMALIZATION =====================

SHORT_URL_DOMAINS = {"amzn.in", "amzn.to", "amzn.eu", "a.co", "fkrt.it", "dl.flipkart.com", "bit.ly", "t.co", "tinyurl.com", "goo.gl"}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}


def _is_short_url(url: str) -> bool:
    """Check if URL is a shortened/redirect link that needs resolution."""
    domain = urlparse(url).netloc.lower().lstrip("www.")
    return domain in SHORT_URL_DOMAINS


async def resolve_url(url: str) -> tuple[str, list[str]]:
    """Follow redirects and return (final_url, redirect_chain). Timeout-safe."""
    redirect_chain = []
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10, headers=HEADERS) as client:
            resp = await client.get(url)
            redirect_chain = [str(h.url) for h in resp.history]
            return str(resp.url), redirect_chain
    except httpx.TimeoutException:
        logger.warning(f"URL resolution timed out: {url}")
        return url, []
    except Exception as e:
        logger.warning(f"URL resolution failed for {url}: {e}")
        return url, []


def normalize_amazon_url(url: str) -> str:
    """Extract ASIN and build canonical Amazon URL."""
    # Match ASIN patterns: /dp/ASIN, /gp/product/ASIN, /gp/aw/d/ASIN
    patterns = [
        r'/dp/([A-Z0-9]{10})',
        r'/gp/product/([A-Z0-9]{10})',
        r'/gp/aw/d/([A-Z0-9]{10})',
        r'/ASIN/([A-Z0-9]{10})',
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            asin = m.group(1)
            # Preserve any existing tag parameter
            parsed = urlparse(url)
            qs = parse_qs(parsed.query)
            tag_params = ""
            if "tag" in qs:
                tag_params = f"?tag={qs['tag'][0]}"
            return f"https://www.amazon.in/dp/{asin}{tag_params}"
    return url


def normalize_flipkart_url(url: str) -> str:
    """Clean Flipkart URL to canonical form."""
    parsed = urlparse(url)
    # Keep only pid and lid params if they exist
    qs = parse_qs(parsed.query)
    keep_params = {}
    for k in ("pid", "lid", "marketplace"):
        if k in qs:
            keep_params[k] = qs[k]
    if keep_params:
        clean_query = urlencode(keep_params, doseq=True)
        return urlunparse(parsed._replace(query=clean_query))
    return url


def detect_platform(url: str) -> str:
    domain = urlparse(url).netloc.lower()
    if any(d in domain for d in ("amazon", "amzn")):
        return "amazon"
    elif any(d in domain for d in ("flipkart", "fkrt")):
        return "flipkart"
    return "unknown"


def extract_asin(url: str) -> str:
    """Extract Amazon ASIN from any URL format."""
    for pat in [r'/dp/([A-Z0-9]{10})', r'/gp/product/([A-Z0-9]{10})', r'/gp/aw/d/([A-Z0-9]{10})']:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    return ""


# ===================== AFFILIATE TAGGING =====================

def tag_affiliate_url(url: str, platform: str, settings: dict) -> str:
    if platform == "amazon":
        tag = settings.get("amazon_affiliate_tag", "")
        if not tag:
            return url
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        qs["tag"] = [tag]
        return urlunparse(parsed._replace(query=urlencode(qs, doseq=True)))
    elif platform == "flipkart":
        affid = settings.get("flipkart_affiliate_id", "")
        if not affid:
            return url
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        qs["affid"] = [affid]
        return urlunparse(parsed._replace(query=urlencode(qs, doseq=True)))
    return url


# ===================== MULTI-LAYER SCRAPING =====================

def _clean_price(text: str) -> int:
    if not text:
        return 0
    cleaned = re.sub(r'[^\d.]', '', text.replace(',', ''))
    try:
        return int(float(cleaned))
    except (ValueError, TypeError):
        return 0


def _extract_json_ld(soup) -> dict:
    """Extract product data from JSON-LD structured data."""
    data = {}
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            ld = json.loads(script.string or "")
            items = ld if isinstance(ld, list) else [ld]
            for item in items:
                if item.get("@type") == "Product":
                    data["title"] = item.get("name", "")
                    data["image_url"] = item.get("image", [""])[0] if isinstance(item.get("image"), list) else item.get("image", "")
                    data["rating"] = str(item.get("aggregateRating", {}).get("ratingValue", ""))
                    data["category"] = item.get("category", "")
                    offers = item.get("offers", {})
                    if isinstance(offers, list) and offers:
                        offers = offers[0]
                    if isinstance(offers, dict):
                        price = offers.get("price") or offers.get("lowPrice")
                        if price:
                            data["current_price"] = _clean_price(str(price))
                    break
        except (json.JSONDecodeError, TypeError):
            continue
    return data


def _extract_opengraph(soup) -> dict:
    """Extract product data from OpenGraph meta tags."""
    data = {}
    og_title = soup.select_one('meta[property="og:title"]')
    if og_title:
        data["title"] = og_title.get("content", "")
    og_image = soup.select_one('meta[property="og:image"]')
    if og_image:
        data["image_url"] = og_image.get("content", "")
    og_price = soup.select_one('meta[property="product:price:amount"], meta[property="og:price:amount"]')
    if og_price:
        data["current_price"] = _clean_price(og_price.get("content", ""))
    og_desc = soup.select_one('meta[property="og:description"]')
    if og_desc:
        data["description"] = og_desc.get("content", "")
    return data


def _extract_amazon_dom(soup) -> dict:
    """Layer 1: Amazon-specific DOM selectors."""
    data = {"features": []}
    t = soup.select_one("#productTitle")
    if t:
        data["title"] = t.get_text(strip=True)
    img = soup.select_one("#landingImage, #imgBlkFront, #main-image, #ebooksImgBlkFront")
    if img:
        data["image_url"] = img.get("data-old-hires") or img.get("data-a-dynamic-image", "").split('"')[1] if '"' in img.get("data-a-dynamic-image", "") else img.get("src") or ""
    p = soup.select_one(".priceToPay .a-offscreen, #corePrice_feature_div .a-offscreen, .a-price .a-offscreen, #priceblock_dealprice, #priceblock_ourprice")
    if p:
        data["current_price"] = _clean_price(p.get_text())
    o = soup.select_one(".basisPrice .a-offscreen, .a-price[data-a-strike='true'] .a-offscreen, .priceBlockStrikePriceString")
    if o:
        data["original_price"] = _clean_price(o.get_text())
    d = soup.select_one(".savingsPercentage, #dealprice_savings .priceBlockSavingsString")
    if d:
        pct = re.sub(r'[^\d]', '', d.get_text())
        if pct:
            data["discount_pct"] = int(pct)
    r = soup.select_one("#acrPopover .a-icon-alt, span.a-icon-alt")
    if r:
        m = re.search(r'(\d+\.?\d*)', r.get_text())
        if m:
            data["rating"] = m.group(1)
    breadcrumbs = soup.select("#wayfinding-breadcrumbs_feature_div li a")
    if breadcrumbs:
        data["category"] = breadcrumbs[-1].get_text(strip=True)
    for f in soup.select("#feature-bullets li span.a-list-item")[:5]:
        txt = f.get_text(strip=True)
        if txt and 5 < len(txt) < 200:
            data["features"].append(txt)
    return data


def _extract_flipkart_dom(soup) -> dict:
    """Layer 1: Flipkart-specific DOM selectors."""
    data = {"features": []}
    t = soup.select_one("span.VU-ZEz, h1.yhB1nd, span.B_NuCI")
    if t:
        data["title"] = t.get_text(strip=True)
    img = soup.select_one("img.DByuf4, img._396cs4, div._3kidJX img")
    if img:
        data["image_url"] = img.get("src") or ""
    p = soup.select_one("div.Nx9bqj.CxhGGd, div._30jeq3, div.Nx9bqj")
    if p:
        data["current_price"] = _clean_price(p.get_text())
    o = soup.select_one("div.yRaY8j.A6\\+E6v, div._3I9_wc, div.yRaY8j")
    if o:
        data["original_price"] = _clean_price(o.get_text())
    d = soup.select_one("div.UkUFwK span, div._3Ay6Sb span, div.UkUFwK")
    if d:
        pct = re.sub(r'[^\d]', '', d.get_text())
        if pct:
            data["discount_pct"] = int(pct)
    r = soup.select_one("div.XQDdHH, div._3LWZlK")
    if r:
        m = re.search(r'(\d+\.?\d*)', r.get_text())
        if m:
            data["rating"] = m.group(1)
    for h in soup.select("li._7eSDEz, li.rgWa7D")[:5]:
        txt = h.get_text(strip=True)
        if txt:
            data["features"].append(txt)
    return data


async def extract_by_scraping(url: str, platform: str) -> dict:
    """Multi-layer scraping: DOM selectors → OpenGraph → JSON-LD. Returns best result."""
    result = {
        "title": "", "image_url": "", "current_price": 0,
        "original_price": 0, "discount_pct": 0, "rating": "",
        "category": "", "platform": platform, "source_url": url,
        "features": []
    }
    try:
        from bs4 import BeautifulSoup
        async with httpx.AsyncClient(follow_redirects=True, timeout=12, headers=HEADERS) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.warning(f"Scraping {platform} returned HTTP {resp.status_code} for {url}")
                return result
            html = resp.text
            soup = BeautifulSoup(html, "lxml")

        # Layer 1: Platform-specific DOM parsing
        if platform == "amazon":
            dom_data = _extract_amazon_dom(soup)
        elif platform == "flipkart":
            dom_data = _extract_flipkart_dom(soup)
        else:
            dom_data = {}

        # Layer 2: OpenGraph meta tags
        og_data = _extract_opengraph(soup)

        # Layer 3: JSON-LD structured data
        ld_data = _extract_json_ld(soup)

        # Merge layers: DOM > JSON-LD > OpenGraph (priority order)
        for key in ("title", "image_url", "current_price", "original_price", "discount_pct", "rating", "category"):
            val = dom_data.get(key) or ld_data.get(key) or og_data.get(key)
            if val:
                result[key] = val

        # Features only from DOM
        if dom_data.get("features"):
            result["features"] = dom_data["features"]

        # Calculate discount if missing
        if not result["discount_pct"] and result["original_price"] and result["current_price"]:
            result["discount_pct"] = round(
                (result["original_price"] - result["current_price"]) / result["original_price"] * 100
            )

        if result["title"]:
            result["extraction_method"] = "scraping"
            logger.info(f"Scraping succeeded for {platform}: {result['title'][:50]}")
        else:
            logger.info(f"Scraping returned no title for {url} — site may have blocked the request")

    except httpx.TimeoutException:
        logger.warning(f"Scraping timed out for {url}")
    except Exception as e:
        logger.error(f"Scraping error for {url}: {type(e).__name__}: {e}")

    return result


# ===================== AI-POWERED EXTRACTION =====================

async def extract_with_ai(url: str, platform: str, api_key: str, asin: str = "") -> dict:
    """Use AI to generate product data from URL. Used when scraping fails."""
    result = {
        "title": "", "image_url": "", "current_price": 0,
        "original_price": 0, "discount_pct": 0, "rating": "",
        "category": "", "platform": platform, "source_url": url,
        "features": []
    }

    product_hint = ""
    if asin:
        product_hint = f"Amazon ASIN: {asin}"
    elif platform == "flipkart":
        slug_match = re.search(r'/([^/]+)/p/', url)
        if slug_match:
            product_hint = f"Flipkart product slug: {slug_match.group(1).replace('-', ' ')}"

    prompt = f"""You are a product data expert. Given this {platform} India URL, identify the product and provide accurate metadata.

URL: {url}
{product_hint}

Return ONLY valid JSON (no markdown, no code blocks):
{{
  "title": "Full product title as listed on {platform}",
  "current_price": 0,
  "original_price": 0,
  "discount_pct": 0,
  "rating": "4.2",
  "category": "Category name",
  "features": ["feature 1", "feature 2", "feature 3"]
}}

Rules:
- Prices in Indian Rupees (integers)
- Identify the product from ASIN/slug if possible
- discount_pct = round((original - current) / original * 100)
- Be as accurate as possible"""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import uuid

        chat = LlmChat(
            api_key=api_key,
            session_id=f"extract_{uuid.uuid4().hex[:8]}",
            system_message="Return only valid JSON. No markdown."
        )
        chat.with_model("openai", "gpt-4o")
        reply = await chat.send_message(UserMessage(text=prompt))

        reply_text = reply.strip()
        if reply_text.startswith("```"):
            reply_text = reply_text.split("\n", 1)[1] if "\n" in reply_text else reply_text[3:]
            if reply_text.endswith("```"):
                reply_text = reply_text[:-3]
            reply_text = reply_text.strip()
            if reply_text.startswith("json"):
                reply_text = reply_text[4:].strip()

        data = json.loads(reply_text)
        result["title"] = data.get("title", "")
        result["current_price"] = int(data.get("current_price", 0))
        result["original_price"] = int(data.get("original_price", 0))
        result["discount_pct"] = int(data.get("discount_pct", 0))
        result["rating"] = str(data.get("rating", ""))
        result["category"] = data.get("category", "")
        result["features"] = data.get("features", [])[:5]
        result["extraction_method"] = "ai"
        logger.info(f"AI extraction succeeded: {result['title'][:50]}")
    except Exception as e:
        logger.error(f"AI extraction error for {url}: {type(e).__name__}: {e}")
        result["extraction_note"] = f"AI extraction failed: {str(e)[:80]}"

    return result


# ===================== MAIN EXTRACTION PIPELINE =====================

async def extract_product(url: str, api_key: str = None) -> dict:
    """
    Full extraction pipeline:
    1. Validate URL
    2. Resolve short URLs (amzn.in, fkrt.it, etc.)
    3. Normalize to canonical format
    4. Multi-layer scrape (DOM → OpenGraph → JSON-LD)
    5. AI fallback if scraping fails
    """
    url = url.strip()

    # Validation
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    parsed = urlparse(url)
    if not parsed.netloc:
        return _empty_result(url, error="Invalid URL format")

    # Step 1: Resolve short/redirect URLs
    original_url = url
    if _is_short_url(url):
        logger.info(f"Resolving short URL: {url}")
        url, chain = await resolve_url(url)
        logger.info(f"Resolved to: {url} (via {len(chain)} redirects)")

    # Step 2: Detect platform from resolved URL
    platform = detect_platform(url)
    if platform == "unknown":
        return _empty_result(url, error="Unsupported platform. Only Amazon India and Flipkart URLs are supported.")

    # Step 3: Normalize URL
    asin = ""
    if platform == "amazon":
        asin = extract_asin(url)
        url = normalize_amazon_url(url)
        logger.info(f"Amazon ASIN: {asin}, Canonical: {url}")
    elif platform == "flipkart":
        url = normalize_flipkart_url(url)

    # Step 4: Multi-layer scraping
    result = await extract_by_scraping(url, platform)
    result["source_url"] = url
    result["original_input_url"] = original_url
    if asin:
        result["asin"] = asin

    # Step 5: AI fallback if scraping got no title
    if not result.get("title") and api_key:
        logger.info(f"Scraping failed, using AI fallback for {url}")
        ai_result = await extract_with_ai(url, platform, api_key, asin=asin)
        if ai_result.get("title"):
            scraped_img = result.get("image_url", "")
            result = ai_result
            result["source_url"] = url
            result["original_input_url"] = original_url
            if asin:
                result["asin"] = asin
            if scraped_img and not result.get("image_url"):
                result["image_url"] = scraped_img
    elif not result.get("title"):
        result["extraction_note"] = "Could not extract product data. Fill in details manually."

    return result


def _empty_result(url: str, error: str = "") -> dict:
    return {
        "title": "", "image_url": "", "current_price": 0,
        "original_price": 0, "discount_pct": 0, "rating": "",
        "category": "", "platform": "unknown", "source_url": url,
        "features": [], "error": error
    }


# ===================== AI CAPTION GENERATION =====================

async def generate_caption(product: dict, api_key: str) -> dict:
    title = product.get("title", "Product")
    price = product.get("current_price", 0)
    orig = product.get("original_price", 0)
    discount = product.get("discount_pct", 0)
    features = product.get("features", [])
    platform = product.get("platform", "")

    features_text = "\n".join(f"- {f}" for f in features[:4]) if features else "No features listed"
    price_text = f"₹{price:,}" if price else "Check link"
    orig_text = f"₹{orig:,}" if orig else ""
    discount_text = f"{discount}% OFF" if discount else ""

    prompt = f"""You are a deal copywriter for DISCCART.IN, India's top deal platform.

Product: {title}
Platform: {platform}
Current Price: {price_text}
Original Price: {orig_text}
Discount: {discount_text}
Features:
{features_text}

Generate 3 things in valid JSON (NO markdown, NO code blocks):

{{
  "telegram_caption": "A Telegram deal post. Structure: deal emoji + product name + price + discount + 2-3 features as checkmarks + urgency line + [LINK] placeholder. Under 300 chars. Indian deal style.",
  "website_description": "2-3 sentence SEO-friendly deal description for website listing.",
  "seo_title": "SEO optimized title under 70 chars"
}}

Rules: Use ₹ symbol, natural language, urgency-based, not spammy, varied."""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import uuid

        chat = LlmChat(
            api_key=api_key,
            session_id=f"caption_{uuid.uuid4().hex[:8]}",
            system_message="Return only valid JSON. No markdown blocks."
        )
        chat.with_model("openai", "gpt-4o")
        reply = await chat.send_message(UserMessage(text=prompt))

        reply_text = reply.strip()
        if reply_text.startswith("```"):
            reply_text = reply_text.split("\n", 1)[1] if "\n" in reply_text else reply_text[3:]
            if reply_text.endswith("```"):
                reply_text = reply_text[:-3]
            reply_text = reply_text.strip()
            if reply_text.startswith("json"):
                reply_text = reply_text[4:].strip()

        return json.loads(reply_text)
    except Exception as e:
        logger.error(f"Caption generation error: {type(e).__name__}: {e}")
        cap = f"Deal Alert!\n{title}\n"
        if price:
            cap += f"₹{price:,}"
        if discount:
            cap += f" ({discount}% OFF)"
        cap += "\n\nLimited time deal!"
        return {
            "telegram_caption": cap,
            "website_description": f"Get {title} at amazing price. Save {discount}% today!",
            "seo_title": title[:70],
            "fallback": True,
            "error": str(e)[:100]
        }


# ===================== TELEGRAM =====================

async def send_telegram(bot_token: str, channel_id: str, caption: str, image_url: str = "", affiliate_url: str = "") -> dict:
    if not bot_token or not channel_id:
        return {"success": False, "error": "Telegram not configured. Add bot token and channel ID in Deal Engine Settings."}

    message = caption
    if "[LINK]" in message and affiliate_url:
        message = message.replace("[LINK]", affiliate_url)
    elif affiliate_url:
        message += f"\n\n{affiliate_url}"

    try:
        api_base = f"https://api.telegram.org/bot{bot_token}"
        async with httpx.AsyncClient(timeout=15) as client:
            if image_url:
                resp = await client.post(f"{api_base}/sendPhoto", json={
                    "chat_id": channel_id, "photo": image_url,
                    "caption": message, "parse_mode": "HTML"
                })
            else:
                resp = await client.post(f"{api_base}/sendMessage", json={
                    "chat_id": channel_id, "text": message, "parse_mode": "HTML"
                })
            data = resp.json()
            if data.get("ok"):
                return {"success": True, "message_id": data["result"]["message_id"]}
            return {"success": False, "error": data.get("description", "Unknown Telegram error")}
    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return {"success": False, "error": str(e)[:200]}


async def test_telegram_connection(bot_token: str, channel_id: str) -> dict:
    if not bot_token:
        return {"success": False, "error": "Bot token is required"}
    if not channel_id:
        return {"success": False, "error": "Channel ID is required"}
    try:
        api_base = f"https://api.telegram.org/bot{bot_token}"
        async with httpx.AsyncClient(timeout=10) as client:
            me_resp = await client.get(f"{api_base}/getMe")
            me_data = me_resp.json()
            if not me_data.get("ok"):
                return {"success": False, "error": f"Invalid bot token: {me_data.get('description', 'Token rejected')}"}
            bot_name = me_data["result"].get("username", "Unknown")
            chat_resp = await client.get(f"{api_base}/getChat", params={"chat_id": channel_id})
            chat_data = chat_resp.json()
            if not chat_data.get("ok"):
                return {"success": False, "error": f"Cannot access channel: {chat_data.get('description', 'Access denied')}. Make sure the bot is admin."}
            channel_name = chat_data["result"].get("title", channel_id)
            return {"success": True, "bot_name": bot_name, "channel_name": channel_name}
    except Exception as e:
        return {"success": False, "error": str(e)[:200]}
