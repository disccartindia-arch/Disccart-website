"""
Deal Engine — Product URL scraping, AI caption generation, affiliate tagging, Telegram publishing.
Modular backend service for Disccart admin automation.
"""

import httpx
import re
import os
import json
import logging
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

logger = logging.getLogger(__name__)

# ===================== URL DETECTION =====================

def detect_platform(url: str) -> str:
    """Detect if URL is Amazon, Flipkart, or unknown."""
    domain = urlparse(url).netloc.lower()
    if "amazon" in domain:
        return "amazon"
    elif "flipkart" in domain:
        return "flipkart"
    elif "amzn" in domain or "amzn.to" in domain:
        return "amazon"
    elif "fkrt" in domain or "dl.flipkart.com" in domain:
        return "flipkart"
    return "unknown"


# ===================== AFFILIATE TAGGING =====================

def tag_affiliate_url(url: str, platform: str, settings: dict) -> str:
    """Append affiliate tag to URL based on platform."""
    if platform == "amazon":
        tag = settings.get("amazon_affiliate_tag", "")
        if not tag:
            return url
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        qs["tag"] = [tag]
        new_query = urlencode(qs, doseq=True)
        return urlunparse(parsed._replace(query=new_query))
    elif platform == "flipkart":
        affid = settings.get("flipkart_affiliate_id", "")
        if not affid:
            return url
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        qs["affid"] = [affid]
        new_query = urlencode(qs, doseq=True)
        return urlunparse(parsed._replace(query=new_query))
    return url


# ===================== PRODUCT EXTRACTION =====================

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}

def _clean_price(text: str) -> int:
    """Extract integer price from text like '₹1,299' or 'Rs. 1299'."""
    if not text:
        return 0
    cleaned = re.sub(r'[^\d.]', '', text.replace(',', ''))
    try:
        return int(float(cleaned))
    except (ValueError, TypeError):
        return 0


async def extract_amazon(url: str) -> dict:
    """Extract product data from Amazon India URL."""
    result = {
        "title": "", "image_url": "", "current_price": 0,
        "original_price": 0, "discount_pct": 0, "rating": "",
        "category": "", "platform": "amazon", "source_url": url,
        "features": []
    }
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                logger.warning(f"Amazon fetch returned {resp.status_code}")
                return result
            soup = BeautifulSoup(resp.text, "lxml")

        # Title
        title_el = soup.select_one("#productTitle")
        if title_el:
            result["title"] = title_el.get_text(strip=True)

        # Image
        img_el = soup.select_one("#landingImage, #imgBlkFront, #main-image")
        if img_el:
            result["image_url"] = img_el.get("data-old-hires") or img_el.get("src") or ""

        # Prices
        price_el = soup.select_one(".a-price .a-offscreen, #priceblock_dealprice, #priceblock_ourprice, .priceToPay .a-offscreen")
        if price_el:
            result["current_price"] = _clean_price(price_el.get_text())

        orig_el = soup.select_one(".a-price[data-a-strike='true'] .a-offscreen, .priceBlockStrikePriceString, .a-text-strike .a-offscreen")
        if orig_el:
            result["original_price"] = _clean_price(orig_el.get_text())

        # Discount
        disc_el = soup.select_one(".savingsPercentage, #dealprice_savings .priceBlockSavingsString")
        if disc_el:
            pct_text = re.sub(r'[^\d]', '', disc_el.get_text())
            result["discount_pct"] = int(pct_text) if pct_text else 0

        # Calculate discount if not found
        if not result["discount_pct"] and result["original_price"] and result["current_price"]:
            result["discount_pct"] = round((result["original_price"] - result["current_price"]) / result["original_price"] * 100)

        # Rating
        rating_el = soup.select_one("#acrPopover, .a-icon-alt")
        if rating_el:
            rating_text = rating_el.get("title") or rating_el.get_text()
            match = re.search(r'(\d+\.?\d*)', rating_text)
            if match:
                result["rating"] = match.group(1)

        # Category breadcrumb
        breadcrumbs = soup.select("#wayfinding-breadcrumbs_feature_div li a, .a-breadcrumb li a")
        if breadcrumbs:
            result["category"] = breadcrumbs[-1].get_text(strip=True)

        # Features
        feature_els = soup.select("#feature-bullets li span.a-list-item")
        for f in feature_els[:5]:
            text = f.get_text(strip=True)
            if text and len(text) > 5 and len(text) < 200:
                result["features"].append(text)

    except Exception as e:
        logger.error(f"Amazon extraction error: {e}")
    return result


async def extract_flipkart(url: str) -> dict:
    """Extract product data from Flipkart URL."""
    result = {
        "title": "", "image_url": "", "current_price": 0,
        "original_price": 0, "discount_pct": 0, "rating": "",
        "category": "", "platform": "flipkart", "source_url": url,
        "features": []
    }
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                logger.warning(f"Flipkart fetch returned {resp.status_code}")
                return result
            soup = BeautifulSoup(resp.text, "lxml")

        # Title
        title_el = soup.select_one("span.VU-ZEz, h1.yhB1nd, span.B_NuCI")
        if title_el:
            result["title"] = title_el.get_text(strip=True)

        # Image
        img_el = soup.select_one("img.DByuf4, img._396cs4, div._3kidJX img")
        if img_el:
            result["image_url"] = img_el.get("src") or ""

        # Prices
        price_el = soup.select_one("div.Nx9bqj.CxhGGd, div._30jeq3, div.Nx9bqj")
        if price_el:
            result["current_price"] = _clean_price(price_el.get_text())

        orig_el = soup.select_one("div.yRaY8j.A6\\+E6v, div._3I9_wc, div.yRaY8j")
        if orig_el:
            result["original_price"] = _clean_price(orig_el.get_text())

        # Discount
        disc_el = soup.select_one("div.UkUFwK span, div._3Ay6Sb span, div.UkUFwK")
        if disc_el:
            pct_text = re.sub(r'[^\d]', '', disc_el.get_text())
            result["discount_pct"] = int(pct_text) if pct_text else 0

        if not result["discount_pct"] and result["original_price"] and result["current_price"]:
            result["discount_pct"] = round((result["original_price"] - result["current_price"]) / result["original_price"] * 100)

        # Rating
        rating_el = soup.select_one("div.XQDdHH, div._3LWZlK")
        if rating_el:
            match = re.search(r'(\d+\.?\d*)', rating_el.get_text())
            if match:
                result["rating"] = match.group(1)

        # Category
        breadcrumbs = soup.select("div._1MR4o5 a, a.R0cyWM")
        if breadcrumbs:
            result["category"] = breadcrumbs[-1].get_text(strip=True)

        # Features / Highlights
        highlights = soup.select("li._7eSDEz, li.rgWa7D")
        for h in highlights[:5]:
            text = h.get_text(strip=True)
            if text:
                result["features"].append(text)

    except Exception as e:
        logger.error(f"Flipkart extraction error: {e}")
    return result


async def extract_product(url: str) -> dict:
    """Main dispatcher — detect platform and extract. Falls back to AI if scraping fails."""
    platform = detect_platform(url)
    result = None

    if platform == "amazon":
        result = await extract_amazon(url)
    elif platform == "flipkart":
        result = await extract_flipkart(url)
    else:
        result = {
            "title": "", "image_url": "", "current_price": 0,
            "original_price": 0, "discount_pct": 0, "rating": "",
            "category": "", "platform": "unknown", "source_url": url,
            "features": [], "error": "Unsupported platform. Only Amazon India and Flipkart are supported."
        }

    # If scraping returned no title (blocked/failed), add a helpful note
    if not result.get("title"):
        result["extraction_note"] = "Could not auto-extract. The site may have blocked the request. Please fill in the product details manually, or use AI Auto-Fill from the Deals & Coupons tab."

    return result


# ===================== AI CAPTION GENERATION =====================

async def generate_caption(product: dict, api_key: str) -> dict:
    """Generate deal caption and description using AI."""
    title = product.get("title", "Product")
    price = product.get("current_price", 0)
    orig = product.get("original_price", 0)
    discount = product.get("discount_pct", 0)
    features = product.get("features", [])
    platform = product.get("platform", "")

    features_text = "\n".join(f"- {f}" for f in features[:4]) if features else "No features available"
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

Generate 3 things in valid JSON format (NO markdown, NO code blocks):

{{
  "telegram_caption": "A Telegram-ready deal post. Use this exact structure: deal alert emoji + product name + price + discount + 2-3 key features as checkmarks + urgency line + link placeholder [LINK]. Use light emoji. Keep under 300 chars. Indian deal style.",
  "website_description": "A 2-3 sentence SEO-friendly deal description for the website listing. Highlight value and savings.",
  "seo_title": "SEO optimized title under 70 chars"
}}

Rules:
- Indian Rupee amounts with ₹ symbol
- Natural, not spammy
- Urgency-based but not fake
- Varied language each time"""

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
        # Fallback caption
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
            "error": str(e)[:100]
        }


# ===================== TELEGRAM PUBLISHING =====================

async def send_telegram(bot_token: str, channel_id: str, caption: str, image_url: str = "", affiliate_url: str = "") -> dict:
    """Send deal post to Telegram channel."""
    if not bot_token or not channel_id:
        return {"success": False, "error": "Telegram bot token or channel ID not configured"}

    # Build message with link
    message = caption
    if "[LINK]" in message and affiliate_url:
        message = message.replace("[LINK]", affiliate_url)
    elif affiliate_url:
        message += f"\n\n{affiliate_url}"

    try:
        api_base = f"https://api.telegram.org/bot{bot_token}"
        async with httpx.AsyncClient(timeout=15) as client:
            if image_url:
                # Send photo with caption
                resp = await client.post(f"{api_base}/sendPhoto", json={
                    "chat_id": channel_id,
                    "photo": image_url,
                    "caption": message,
                    "parse_mode": "HTML"
                })
            else:
                # Send text only
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
