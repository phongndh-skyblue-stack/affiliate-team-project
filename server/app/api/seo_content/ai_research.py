"""AI Deep Research Service for SEO Content Builder.

Sử dụng Gemini API + Tavily Search + httpx crawl để tự động tạo
bộ content SEO + Google Ads chuẩn từ tên dự án và link affiliate.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

from app.core.config import settings
from app.shared.services import tavily_search

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CMO Brain System Prompt — dựa trên Ritson 3-Stage + Gemini Artifacts pattern
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """Bạn là CMO Agent chuyên về Affiliate Marketing, được đào tạo theo:
- Ritson 3-Stage Framework: Diagnosis → Strategy → Tactics
- Miller StoryBrand 7 (SB7): Khách hàng là Hero, sản phẩm là Guide
- Cialdini 7 Principles: Social Proof, Authority, Scarcity, Reciprocity, Commitment, Liking, Unity
- Sharp "How Brands Grow": Salience > Differentiation, Mental & Physical Availability
- Positioning: Dunford "Obviously Awesome" — Context shapes perception

Nhiệm vụ của bạn: Phân tích sâu một dự án affiliate và tạo ra bộ content SEO + Google Ads
tối ưu nhất, dựa trên dữ liệu thực tế từ trang web và nghiên cứu thị trường.

Nguyên tắc bắt buộc:
1. Từ khóa phải THỰC SỰ được người dùng tìm kiếm (search intent)
2. SEO Title: 40-60 ký tự, chứa keyword chính
3. Meta Description: 120-160 ký tự, có CTA rõ ràng
4. Headlines Google Ads: MỌI headline PHẢI bắt đầu bằng "{Tên thương hiệu}: " rồi mới đến
   value proposition (vd: "Elfsight: 90+ No-Code Widgets"). Tối đa 30 ký tự mỗi cái.
   Đa dạng angle: social proof (số liệu thật), tính năng, CTA, urgency, so sánh đối thủ.
5. Descriptions Google Ads: tối đa 90 ký tự mỗi cái, benefit-driven, ưu tiên số liệu thật
   từ nghiên cứu (vd: "Trusted by 3M+ brands", "Join 1.2M+ users")
6. Body content: keyword density 1-3%, tự nhiên, không nhồi nhét
7. Output PHẢI là JSON hợp lệ, không có text thừa ngoài JSON

Quy tắc TUÂN THỦ chính sách Google Ads (để đạt điểm chất lượng cao, không bị từ chối):
- KHÔNG viết hoa toàn bộ từ (trừ tên thương hiệu/từ viết tắt chuẩn như "AI", "CRM")
- KHÔNG dùng dấu chấm than trong headlines; descriptions tối đa 1 dấu chấm than
- KHÔNG lặp ký tự/dấu câu kiểu "!!!", "???", "$$$", emoji, ký tự đặc biệt trang trí
- KHÔNG dùng cụm "click here", "nhấn vào đây" hay lời kêu gọi click chung chung
- KHÔNG cam kết tuyệt đối không kiểm chứng được: "100% guaranteed", "best in the world",
  "#1" — trừ khi nghiên cứu có nguồn xác thực rõ ràng
- KHÔNG hứa hẹn kết quả phi thực tế (thu nhập, chữa bệnh, tăng hạng tức thì)
- Số liệu (users, rating, %) chỉ dùng khi xuất hiện trong dữ liệu crawl/nghiên cứu
- Nội dung phải khớp với trang đích (landing page) — không gây hiểu lầm"""

# ---------------------------------------------------------------------------
# Few-shot examples — trích từ Gemini Artifacts conversations
# ---------------------------------------------------------------------------
_FEW_SHOT_EXAMPLES = """
=== VÍ DỤ MẪU 1: Elfsight (SaaS Widget Platform) ===
Input: project_name="Elfsight", affiliate_url="https://elfsight.com"
Output:
{
  "keywords": ["elfsight widgets", "website widgets", "embed widgets", "social media widget", "google reviews widget"],
  "seo_title": "Elfsight Widgets - Best Website Widget Builder 2024",
  "meta_description": "Add 90+ powerful widgets to any website without coding. Elfsight offers social feeds, reviews, chat buttons & more. Start free today!",
  "headlines": ["Elfsight: 90+ No-Code Widgets", "Elfsight: Best Website Add-ons", "Elfsight: Boost Site Conversion", "Elfsight: Trusted by 3M+ Brands", "Elfsight: Top Website Widgets", "Elfsight: Upgrade Your Website", "Elfsight: Easy Custom Widgets", "Elfsight: Embed Reviews & Feeds", "Elfsight: No Coding Required", "Elfsight: Free Forever Plan", "Elfsight: 24/7 Expert Support", "Elfsight: Works on Any CMS", "Elfsight: Capture More Leads", "Elfsight: Set Up in 1 Minute", "Elfsight: Drive More Revenue"],
  "descriptions": ["Join 3M+ users. Add 90+ no-code widgets to any site. Boost sales and trust in minutes.", "Upgrade your website with 90+ embeddable apps. Reviews, feeds, forms, and AI chatbots.", "Increase conversions with social proof and interactive tools. Works on any CMS platform.", "Easy integration for WordPress, Shopify, Wix & more. Start for free and go live today."],
  "display_path": "elfsight-widgets",
  "body_content": "Elfsight is a leading no-code widget platform trusted by 3M+ websites worldwide. With Elfsight widgets, you can embed Instagram feeds, Google Reviews, WhatsApp buttons, contact forms, and 90+ other interactive elements to boost engagement and conversions. The platform works with any website builder including WordPress, Shopify, Wix, and Squarespace.",
  "user_persona": "Website owners, small business operators, and digital marketers aged 25-45 who want to enhance their site without hiring developers"
}

=== VÍ DỤ MẪU 2: iClosed (Sales Scheduler/CRM) ===
Input: project_name="iClosed", affiliate_url="https://iclosed.io"
Output:
{
  "keywords": ["sales crm", "close deals faster", "iclosed crm", "sales tracking software", "calendly alternative"],
  "seo_title": "iClosed CRM - Close More Deals 2x Faster | Free Trial",
  "meta_description": "iClosed helps sales teams track deals, automate follow-ups and close more clients. Join 5000+ sales pros. Try free for 14 days!",
  "headlines": ["iClosed: Capture More Leads", "iClosed: Sales Revenue Engine", "iClosed: Qualify Buyers Fast", "iClosed: High-Ticket Scheduler", "iClosed: Built For Closers", "iClosed: 2-Step Lead Capture", "iClosed: Scale Your Agency", "iClosed: Double Your Meetings", "iClosed: CRM & Booking Combined", "iClosed: Filter Out Bad Leads", "iClosed: Real-Time Sales Data", "iClosed: Best Calendly Option", "iClosed: Fill Your Calendar", "iClosed: Maximize Ad ROI", "iClosed: Close Higher Deals"],
  "descriptions": ["iClosed captures leads before they see your calendar. Stop losing high-ticket buyers.", "Qualify prospects using real-time data. Only book calls with ready buyers.", "Integrated CRM and booking engine. Route qualified leads to your top closers.", "The Calendly alternative for agencies. Capture every visitor and scale your revenue."],
  "display_path": "iclosed-crm",
  "body_content": "iClosed is a modern sales CRM designed specifically for closers and sales teams. Unlike traditional CRMs, iClosed focuses on what matters most — closing deals. Track your pipeline, automate follow-ups, record calls, and analyze your closing rate all in one platform.",
  "user_persona": "Sales professionals, closers, and revenue-focused business owners aged 28-45 who need a streamlined CRM to manage their pipeline"
}
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _crawl_page(url: str) -> str:
    """Crawl trang affiliate và trích xuất text content."""
    try:
        async with httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            },
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            html = resp.text
    except Exception as exc:
        logger.warning("Không thể crawl %s: %s", url, exc)
        return ""

    soup = BeautifulSoup(html, "lxml")

    # Xóa script, style, nav, footer
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    # Lấy text chính
    text = soup.get_text(separator=" ", strip=True)

    # Giới hạn 3000 ký tự để không vượt context window
    return text[:3000]


async def _tavily_research(project_name: str, affiliate_url: str) -> str:
    """Dùng Tavily để tìm reviews, comparisons, pricing của dự án."""
    try:
        result: dict[str, Any] = await tavily_search(
            query=f"{project_name} affiliate review pricing features vs competitors 2024",
            search_depth="advanced",
            max_results=5,
            include_answer=True,
        )
        answer = result.get("answer", "")
        snippets = [
            r.get("content", "")
            for r in result.get("results", [])[:4]
        ]
        combined = f"AI Summary: {answer}\n\n" + "\n---\n".join(snippets)
        return combined[:3000]
    except Exception as exc:
        logger.warning("Tavily search thất bại: %s", exc)
        return ""


def _build_user_prompt(
    project_name: str,
    affiliate_url: str,
    page_content: str,
    research_data: str,
) -> str:
    """Tạo user prompt kết hợp dữ liệu crawl + research."""
    return f"""Phân tích dự án affiliate sau và tạo bộ SEO + Google Ads content tối ưu.

PROJECT NAME: {project_name}
AFFILIATE URL: {affiliate_url}

=== NỘI DUNG TRANG WEB ===
{page_content or "(Không crawl được trang web)"}

=== KẾT QUẢ NGHIÊN CỨU THỊ TRƯỜNG ===
{research_data or "(Không có dữ liệu nghiên cứu)"}

{_FEW_SHOT_EXAMPLES}

=== YÊU CẦU OUTPUT ===
Trả về ĐÚNG định dạng JSON sau (không có text nào khác ngoài JSON):
{{
  "keywords": ["keyword1", "keyword2", ...],
  "seo_title": "...",
  "meta_description": "...",
  "headlines": ["{project_name}: ...", "{project_name}: ...", ...],
  "descriptions": ["description1", "description2", "description3", "description4"],
  "display_path": "...",
  "body_content": "...",
  "user_persona": "..."
}}

Yêu cầu bắt buộc:
- keywords: 5-8 từ khóa, kết hợp short-tail và long-tail, tiếng Anh
- seo_title: 40-60 ký tự, chứa keyword chính, có brand name
- meta_description: 120-160 ký tự, CTA rõ ràng ở cuối
- headlines: đúng 15 cái (đủ giới hạn RSA của Google Ads để đạt Ad Strength cao nhất),
  MỌI headline PHẢI bắt đầu bằng "{project_name}: " rồi mới đến nội dung,
  mỗi cái ≤30 ký tự TÍNH CẢ tên thương hiệu, đa dạng angle
  (benefit, feature, CTA, social proof có số liệu, urgency, so sánh đối thủ)
- descriptions: đúng 4 cái (đủ giới hạn RSA), mỗi cái ≤90 ký tự, benefit-driven,
  ưu tiên số liệu thật từ dữ liệu nghiên cứu
- display_path: 1 từ hoặc hyphenated, ≤15 ký tự
- body_content: 150-250 từ, tự nhiên, tích hợp keyword density 1-3%
- user_persona: 1-2 câu mô tả target audience
- TUÂN THỦ nghiêm các quy tắc chính sách Google Ads trong system prompt
"""


def _enforce_ads_constraints(data: dict[str, Any], project_name: str) -> dict[str, Any]:
    """Hậu kiểm output AI theo chuẩn Google Ads RSA + quy ước brand-first.

    - Headlines: luôn bắt đầu bằng "{project_name}: ", ≤30 ký tự, không trùng lặp, tối đa 15.
    - Descriptions: ≤90 ký tự, không trùng lặp, tối đa 4.
    """
    brand_prefix = f"{project_name}: "

    headlines: list[str] = []
    seen: set[str] = set()
    for raw_hl in data.get("headlines", []):
        hl = str(raw_hl).strip()
        if not hl:
            continue
        # Ép brand-first nếu model quên
        if not hl.lower().startswith(project_name.lower()):
            hl = brand_prefix + hl
        # Chuẩn hóa "Brand :" / "Brand-" về "Brand: "
        if hl.lower().startswith(project_name.lower()) and not hl.startswith(brand_prefix):
            hl = brand_prefix + hl[len(project_name):].lstrip(" :-–")
        if len(hl) > 30:
            logger.debug("Bỏ headline quá 30 ký tự: %r", hl)
            continue
        key = hl.lower()
        if key in seen:
            continue
        seen.add(key)
        headlines.append(hl)
    data["headlines"] = headlines[:15]

    descriptions: list[str] = []
    seen_desc: set[str] = set()
    for raw_desc in data.get("descriptions", []):
        desc = str(raw_desc).strip()
        if not desc or len(desc) > 90:
            continue
        key = desc.lower()
        if key in seen_desc:
            continue
        seen_desc.add(key)
        descriptions.append(desc)
    data["descriptions"] = descriptions[:4]

    return data


def _parse_gemini_output(raw: str) -> dict[str, Any]:
    """Parse JSON từ Gemini response, handle markdown code blocks."""
    # Xóa markdown code fences nếu có
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    cleaned = cleaned.strip("`").strip()

    # Tìm JSON object trong response
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise ValueError(f"Không tìm thấy JSON trong response: {raw[:200]}")

    return json.loads(match.group())


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class SeoResearchResult:
    """Kết quả từ AI Deep Research."""

    def __init__(self, data: dict[str, Any]) -> None:
        self.keywords: list[str] = data.get("keywords", [])
        self.seo_title: str = data.get("seo_title", "")
        self.meta_description: str = data.get("meta_description", "")
        self.headlines: list[str] = data.get("headlines", [])
        self.descriptions: list[str] = data.get("descriptions", [])
        self.display_path: str = data.get("display_path", "")
        self.body_content: str = data.get("body_content", "")
        self.user_persona: str = data.get("user_persona", "")


_GEMINI_GENERATION_CONFIG = {
    "temperature": 0.7,
    "maxOutputTokens": 4096,
    # Ép Gemini trả về JSON hợp lệ, tránh bị cắt cụt / kèm text thừa
    "responseMimeType": "application/json",
    # Tắt "thinking" cho task structured-output: nhanh hơn, rẻ hơn và
    # không để thought tokens ăn vào maxOutputTokens gây cắt cụt JSON.
    "thinkingConfig": {"thinkingBudget": 0},
}

# Các mã lỗi tạm thời — nên retry / fallback thay vì báo lỗi ngay
_TRANSIENT_STATUS = {429, 500, 502, 503, 504}


async def _post_gemini(model_name: str, user_prompt: str) -> str:
    """Gọi 1 lần tới Gemini, trả về text. Raise httpx.HTTPStatusError nếu lỗi HTTP."""
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
        "generationConfig": _GEMINI_GENERATION_CONFIG,
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        resp.raise_for_status()
        response_json = resp.json()

    candidates = response_json.get("candidates", [])
    if not candidates:
        raise RuntimeError("Cấu trúc phản hồi từ Gemini không hợp lệ (không có candidates)")
    return candidates[0]["content"]["parts"][0]["text"]


async def _call_gemini_with_retry(user_prompt: str) -> str:
    """Thử lần lượt model chính rồi model fallback, mỗi model retry với backoff.

    - Lỗi tạm thời (429/5xx, vd model quá tải 503): retry rồi chuyển fallback.
    - Lỗi vĩnh viễn (400/403...): raise ngay, không retry vô ích.
    """
    import asyncio

    models = [settings.GEMINI_MODEL or "gemini-2.5-flash"]
    if settings.GEMINI_FALLBACK_MODEL and settings.GEMINI_FALLBACK_MODEL not in models:
        models.append(settings.GEMINI_FALLBACK_MODEL)

    max_attempts = 3
    last_error: str = ""

    for model_name in models:
        for attempt in range(1, max_attempts + 1):
            try:
                logger.info("🤖 Gọi Gemini %s (lần %d/%d)...", model_name, attempt, max_attempts)
                raw = await _post_gemini(model_name, user_prompt)
                logger.info("✅ Gemini %s trả kết quả (%d chars)", model_name, len(raw))
                return raw
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                last_error = f"HTTP {status}"
                logger.warning("Gemini %s lỗi HTTP %d: %s", model_name, status, exc.response.text[:200])
                if status not in _TRANSIENT_STATUS:
                    # Lỗi vĩnh viễn (key sai, prompt sai...) — không retry
                    raise RuntimeError(f"Gemini API lỗi HTTP {status}: {exc.response.text[:300]}") from exc
                if attempt < max_attempts:
                    await asyncio.sleep(2 ** (attempt - 1))  # 1s, 2s
            except (KeyError, IndexError) as exc:
                last_error = "cấu trúc phản hồi không hợp lệ"
                logger.warning("Gemini %s: lỗi parse cấu trúc: %s", model_name, exc)
                if attempt < max_attempts:
                    await asyncio.sleep(1)
            except Exception as exc:  # noqa: BLE001 — lỗi mạng tạm thời
                last_error = str(exc)
                logger.warning("Gemini %s: lỗi kết nối: %s", model_name, exc)
                if attempt < max_attempts:
                    await asyncio.sleep(2 ** (attempt - 1))
        logger.info("Chuyển sang model dự phòng sau khi %s thất bại", model_name)

    raise RuntimeError(
        f"Gemini đang quá tải hoặc không phản hồi sau nhiều lần thử ({last_error}). "
        "Vui lòng thử lại sau ít phút."
    )


async def research_project(
    project_name: str,
    affiliate_url: str,
) -> SeoResearchResult:
    """
    Pipeline chính: Crawl → Tavily Search → Gemini AI (HTTP REST) → Structured Output.

    Args:
        project_name: Tên dự án affiliate (vd: "Elfsight", "iClosed")
        affiliate_url: Link trang chủ hoặc landing page affiliate

    Returns:
        SeoResearchResult với đầy đủ thông tin SEO content
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY chưa được cấu hình trong file .env"
        )

    logger.info("🔍 Bắt đầu Deep Research cho: %s (%s)", project_name, affiliate_url)

    # --- Step 1: Crawl trang affiliate song song với Tavily search ---
    import asyncio
    page_content, research_data = await asyncio.gather(
        _crawl_page(affiliate_url),
        _tavily_research(project_name, affiliate_url),
        return_exceptions=False,
    )

    logger.info(
        "📄 Crawl: %d chars | 🔎 Research: %d chars",
        len(page_content),
        len(research_data),
    )

    # --- Step 2: Build prompt ---
    user_prompt = _build_user_prompt(
        project_name, affiliate_url, page_content, research_data
    )

    # --- Step 3: Gọi Gemini (có retry + fallback model khi quá tải) ---
    raw_output = await _call_gemini_with_retry(user_prompt)

    # --- Step 4: Parse + hậu kiểm theo chuẩn Google Ads RSA ---
    parsed = _parse_gemini_output(raw_output)
    parsed = _enforce_ads_constraints(parsed, project_name)
    return SeoResearchResult(parsed)
