"""
Deal Engine — Product URL extraction (AI-powered + scraping fallback), AI caption generation,
affiliate tagging, Telegram publishing.
Modular backend service for Disccart admin automation.
"""

import httpx
import re
import os
import json
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

logger = logging.getLogger(__name__)

# ===================== URL DETECTION =====================

def detect_platform(url: str) -> str:
    domain = urlparse(url).netloc.lower()
    if "amazon" in domain or "amzn" in domain:
        return "amazon"
    elif "flipkart" in domain or "fkrt" in domain:
        return "flipkart"
    return "unknown"


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


# ===================== AI-POWERED EXTRACTION =====================

async def extract_with_ai(url: str, platform: str, api_key: str) -> dict:
    """Use AI to generate realistic product data from a URL. Primary extraction method."""
    result = {
        "title": "", "image_url": "", "current_price": 0,
        "original_price": 0, "discount_pct": 0, "rating": "",
        "category": "", "platform": platform, "source_url": url,
        "features": []
    }

    # Try to extract ASIN or product identifier from URL
    product_hint = ""
    if platform == "amazon":
        asin_match = re.search(r'/dp/([A-Z0-9]{10})', url) or re.search(r'/gp/product/([A-Z0-9]{10})', url)
        if asin_match:
            product_hint = f"Amazon ASIN: {asin_match.group(1)}"
    elif platform == "flipkart":
        slug_match = re.search(r'/([^/]+)/p/', url)
        if slug_match:
            product_hint = f"Flipkart product slug: {slug_match.group(1).replace('-', ' ')}"

    prompt = f"""You are a product data extraction expert. Given this {platform} URL and hints, generate realistic product metadata.

URL: {url}
{product_hint}

Based on the URL pattern and product identifier, provide your best estimate of the product.
Return ONLY valid JSON (no markdown, no code blocks):
{{
  "title": "Full product title as it would appear on {platform}",
  "current_price": 0,
  "original_price": 0,
  "discount_pct": 0,
  "rating": "4.2",
  "category": "Category name",
  "features": ["feature 1", "feature 2", "feature 3"]
}}

Rules:
- Prices must be realistic Indian Rupees (integers)
- If you can identify the product from the URL, provide accurate data
- If you cannot identify it, make reasonable estimates based on the URL pattern
- discount_pct = round((original - current) / original * 100)"""

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
    except Exception as e:
        logger.error(f"AI extraction error: {e}")
        result["extraction_note"] = f"AI extraction failed: {str(e)[:100]}"

    return result


# ===================== SCRAPING EXTRACTION (FALLBACK) =====================

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
}

def _clean_price(text: str) -> int:
    if not text:
        return 0
    cleaned = re.sub(r'[^\d.]', '', text.replace(',', ''))
    try:
        return int(float(cleaned))
    except (ValueError, TypeError):
        return 0


async def extract_by_scraping(url: str, platform: str) -> dict:
    """Scrape product page. Returns empty fields if blocked."""
    result = {
        "title": "", "image_url": "", "current_price": 0,
        "original_price": 0, "discount_pct": 0, "rating": "",
        "category": "", "platform": platform, "source_url": url,
        "features": []
    }
    try:
        from bs4 import BeautifulSoup
        async with httpx.AsyncClient(follow_redirects=True, timeout=12) as client:
            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                return result
            soup = BeautifulSoup(resp.text, "lxml")

        if platform == "amazon":
            t = soup.select_one("#productTitle")
            if t:
                result["title"] = t.get_text(strip=True)
            img = soup.select_one("#landingImage, #imgBlkFront")
            if img:
                result["image_url"] = img.get("data-old-hires") or img.get("src") or ""
            p = soup.select_one(".a-price .a-offscreen, .priceToPay .a-offscreen")
            if p:
                result["current_price"] = _clean_price(p.get_text())
            o = soup.select_one(".a-price[data-a-strike='true'] .a-offscreen")
            if o:
                result["original_price"] = _clean_price(o.get_text())
            d = soup.select_one(".savingsPercentage")
            if d:
                result["discount_pct"] = int(re.sub(r'[^\d]', '', d.get_text()) or 0)
            for f in soup.select("#feature-bullets li span.a-list-item")[:5]:
                txt = f.get_text(strip=True)
                if txt and 5 < len(txt) < 200:
                    result["features"].append(txt)

        elif platform == "flipkart":
            t = soup.select_one("span.VU-ZEz, h1.yhB1nd, span.B_NuCI")
            if t:
                result["title"] = t.get_text(strip=True)
            img = soup.select_one("img.DByuf4, img._396cs4")
            if img:
                result["image_url"] = img.get("src") or ""
            p = soup.select_one("div.Nx9bqj.CxhGGd, div._30jeq3, div.Nx9bqj")
            if p:
                result["current_price"] = _clean_price(p.get_text())
            o = soup.select_one("div.yRaY8j, div._3I9_wc")
            if o:
                result["original_price"] = _clean_price(o.get_text())
            for h in soup.select("li._7eSDEz, li.rgWa7D")[:5]:
                txt = h.get_text(strip=True)
                if txt:
                    result["features"].append(txt)

        # Calculate discount if not found
        if not result["discount_pct"] and result["original_price"] and result["current_price"]:
            result["discount_pct"] = round((result["original_price"] - result["current_price"]) / result["original_price"] * 100)

        if result["title"]:
            result["extraction_method"] = "scraping"

    except Exception as e:
        logger.error(f"Scraping error: {e}")

    return result


# ===================== MAIN EXTRACTION =====================

async def extract_product(url: str, api_key: str = None) -> dict:
    """Extract product data. Tries scraping first, falls back to AI."""
    platform = detect_platform(url)
    if platform == "unknown":
        return {
            "title": "", "image_url": "", "current_price": 0,
            "original_price": 0, "discount_pct": 0, "rating": "",
            "category": "", "platform": "unknown", "source_url": url,
            "features": [], "error": "Unsupported platform. Only Amazon India and Flipkart supported."
        }

    # Try scraping first (free, no API cost)
    result = await extract_by_scraping(url, platform)

    # If scraping failed (no title), use AI
    if not result.get("title") and api_key:
        logger.info(f"Scraping returned no title for {url}, trying AI extraction")
        ai_result = await extract_with_ai(url, platform, api_key)
        if ai_result.get("title"):
            # Keep any image URL from scraping, merge with AI data
            scraped_img = result.get("image_url", "")
            result = ai_result
            if scraped_img and not result.get("image_url"):
                result["image_url"] = scraped_img
    elif not result.get("title"):
        result["extraction_note"] = "Could not extract product data. Please fill in details manually."

    return result


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
        logger.error(f"Caption generation error: {e}")
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


# ===================== TELEGRAM PUBLISHING =====================

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
                    "chat_id": channel_id,
                    "photo": image_url,
                    "caption": message,
                    "parse_mode": "HTML"
                })
            else:
                resp = await client.post(f"{api_base}/sendMessage", json={
                    "chat_id": channel_id,
                    "text": message,
                    "parse_mode": "HTML"
                })

            data = resp.json()
            if data.get("ok"):
                return {"success": True, "message_id": data["result"]["message_id"]}
            else:
                return {"success": False, "error": data.get("description", "Unknown Telegram error")}
    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return {"success": False, "error": str(e)[:200]}


async def test_telegram_connection(bot_token: str, channel_id: str) -> dict:
    """Test Telegram bot connection by calling getMe and checking channel access."""
    if not bot_token:
        return {"success": False, "error": "Bot token is required"}
    if not channel_id:
        return {"success": False, "error": "Channel ID is required"}

    try:
        api_base = f"https://api.telegram.org/bot{bot_token}"
        async with httpx.AsyncClient(timeout=10) as client:
            # Test bot token
            me_resp = await client.get(f"{api_base}/getMe")
            me_data = me_resp.json()
            if not me_data.get("ok"):
                return {"success": False, "error": f"Invalid bot token: {me_data.get('description', 'Token rejected')}"}

            bot_name = me_data["result"].get("username", "Unknown")

            # Test channel access
            chat_resp = await client.get(f"{api_base}/getChat", params={"chat_id": channel_id})
            chat_data = chat_resp.json()
            if not chat_data.get("ok"):
                return {"success": False, "error": f"Cannot access channel: {chat_data.get('description', 'Access denied')}. Make sure the bot is added as admin to the channel."}

            channel_name = chat_data["result"].get("title", channel_id)
            return {"success": True, "bot_name": bot_name, "channel_name": channel_name}

    except Exception as e:
        return {"success": False, "error": str(e)[:200]}
