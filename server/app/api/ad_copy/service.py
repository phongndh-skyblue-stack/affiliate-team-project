from __future__ import annotations

import json
import re
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from app.api.ad_copy.schema import AdCopyGenerateRequest, AdCopyGenerateResponse, SitelinkItem
from app.core.config import settings

HEADLINE_LIMIT = 30
DESCRIPTION_LIMIT = 90
SITELINK_TEXT_LIMIT = 25
SITELINK_DESCRIPTION_LIMIT = 35
CALLOUT_LIMIT = 25
SITELINK_COUNT = 6
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
POLICY_SENSITIVE_TERMS = [
    "crypto",
    "trading",
    "investment",
    "profit",
    "earn money",
    "high return",
    "guarantee",
    "free money",
    "token",
    "exchange",
    "wallet",
    "leverage",
    "income",
    "best",
    "number 1",
    "guaranteed",
    "instant result",
]


@dataclass
class LandingPageContent:
    url: str
    domain: str
    title: str | None
    description: str | None
    headings: list[str]
    paragraphs: list[str]
    links: list[tuple[str, str]]

    @property
    def summary(self) -> str:
        parts = [self.description, *self.headings[:3], *self.paragraphs[:2]]
        text = " ".join(part for part in parts if part)
        return _limit_sentence(text or f"Nội dung quảng cáo từ {self.domain}", 220)


class AdCopyService:
    async def generate(self, payload: AdCopyGenerateRequest) -> AdCopyGenerateResponse:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured.")

        url = _normalize_url(payload.landing_page_url)
        keyword = _compact(payload.keyword)
        page = await _scan_landing_page(url)
        generated = await _generate_with_gemini(page, keyword, payload.language)

        return AdCopyGenerateResponse(
            landing_page_title=page.title,
            landing_page_summary=page.summary,
            keyword_headlines=_require_items(generated, "keyword_headlines", 5, HEADLINE_LIMIT),
            headlines=_require_items(generated, "headlines", 15, HEADLINE_LIMIT),
            descriptions=_require_items(generated, "descriptions", 4, DESCRIPTION_LIMIT),
            sitelinks=_require_sitelinks(generated, page.url),
            callouts=_require_items(generated, "callouts", 6, CALLOUT_LIMIT),
            structured_snippets=_require_items(generated, "structured_snippets", 1, DESCRIPTION_LIMIT),
            words_to_avoid=_require_items(generated, "words_to_avoid", 8, 40),
            safer_content_directions=_require_items(generated, "safer_content_directions", 4, 120),
            sensitive_content_note=_require_text(generated, "sensitive_content_note", 220),
        )


async def _generate_with_gemini(
    page: LandingPageContent,
    keyword: str,
    language: str,
) -> dict:
    prompt = _build_prompt(page, keyword, language)
    model = settings.GEMINI_MODEL.strip() or "gemini-2.5-flash"
    url = f"{GEMINI_BASE_URL}/models/{model}:generateContent"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "keyword_headlines": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "headlines": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "descriptions": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "sitelinks": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "text": {"type": "STRING"},
                                "description1": {"type": "STRING"},
                                "description2": {"type": "STRING"},
                                "finalUrl": {"type": "STRING"},
                            },
                            "required": ["text", "description1", "description2", "finalUrl"],
                        },
                    },
                    "callouts": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "structured_snippets": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "words_to_avoid": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "safer_content_directions": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "sensitive_content_note": {"type": "STRING"},
                },
                "required": [
                    "keyword_headlines",
                    "headlines",
                    "descriptions",
                    "sitelinks",
                    "callouts",
                    "structured_snippets",
                    "words_to_avoid",
                    "safer_content_directions",
                    "sensitive_content_note",
                ],
            },
        },
    }

    async with httpx.AsyncClient(timeout=45.0, trust_env=False) as client:
        try:
            response = await client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": settings.GEMINI_API_KEY,
                },
                json=payload,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = _extract_gemini_error(exc.response)
            raise RuntimeError(f"Gemini API error: {detail}") from exc
        except httpx.RequestError as exc:
            raise RuntimeError("Could not connect to Gemini API.") from exc
    data = response.json()
    text = _extract_gemini_text(data)
    return _parse_json_object(text)


def _extract_gemini_error(response: httpx.Response) -> str:
    try:
        data = response.json()
        message = data.get("error", {}).get("message")
        if message:
            return str(message)
    except ValueError:
        pass
    return f"HTTP {response.status_code}"


def _build_prompt(page: LandingPageContent, keyword: str, language: str) -> str:
    output_language = "Vietnamese" if language == "vi" else "English"
    nav_examples = (
        f"{keyword} Official Site; {keyword} Website; Welcome to {keyword}; "
        f"Visit {keyword} Online; {keyword} Official Page; {keyword} Platform; "
        f"{keyword} Web Portal; Access {keyword} Site; Explore {keyword}; Open {keyword} Online"
    )
    sitelink_examples = (
        "Sign Up Today; Create Your Account; Get Started Online; "
        "Start in Minutes; Join the Platform; Visit Online"
    )
    links = "\n".join(f"- {label}: {href}" for label, href in page.links[:8]) or "- No links found"
    headings = "\n".join(f"- {item}" for item in page.headings[:12]) or "- No headings found"
    paragraphs = "\n".join(f"- {item}" for item in page.paragraphs[:8]) or "- No body text found"
    avoid_terms = ", ".join(POLICY_SENSITIVE_TERMS)

    return f"""
You are a cautious Google Ads copywriter and policy reviewer.
Use ONLY the landing page content below and the target keyword to create neutral ad assets.
Return valid JSON only, no markdown.

Language: {output_language}
All generated strings, including safety suggestions and sensitive_content_note, must be in {output_language}.
Target keyword: {keyword}
Landing page URL: {page.url}
Domain: {page.domain}
Page title: {page.title or ""}
Meta description: {page.description or ""}

Headings:
{headings}

Body text:
{paragraphs}

Candidate sitelink URLs:
{links}

Hard requirements:
- keyword_headlines: exactly 5 strings, each must contain the exact target keyword "{keyword}".
- keyword_headlines must be official/navigation-style, not sales-style.
- keyword_headlines examples and direction: {nav_examples}.
- For keyword_headlines, prioritize brand name or the target keyword, avoid direct crypto/trading/investment wording if risky, and never promise outcomes.
- headlines: exactly 15 strings.
- descriptions: exactly 4 strings.
- sitelinks: exactly {SITELINK_COUNT} objects with text, description1, description2, finalUrl.
- Sitelink titles should use neutral onboarding/navigation CTAs when suitable, for example: {sitelink_examples}.
- At least 4 of the 6 sitelink titles should follow that onboarding/navigation CTA style.
- Do not use promotional sitelink titles or outcome-focused sitelink titles.
- callouts: exactly 6 strings.
- structured_snippets: exactly 1 string.
- words_to_avoid: exactly 8 to 13 strings.
- safer_content_directions: exactly 4 strings.
- sensitive_content_note: exactly 1 concise string.
- Google Ads limits: headlines and keyword_headlines max 30 characters each; descriptions max 90 characters; sitelink text max 25 characters; sitelink descriptions max 35 characters; callouts max 25 characters.
- Write neutral, professional copy. Do not exaggerate.
- Avoid policy-sensitive terms and close variants, especially: {avoid_terms}.
- Do not use strong claims such as "best", "number 1", "guaranteed", or "instant result".
- Make the copy suitable for Google Ads.
- Focus on general benefits only: convenience, security, smart tools, user experience, easy management, quick support.
- Base the copy on the scanned landing page. Do not invent unsupported claims, prices, guarantees, discounts, profit claims, financial outcomes, or medical/legal promises.
- If the landing page has sensitive elements, keep wording generic and describe tools/features neutrally.

JSON shape:
{{
  "keyword_headlines": ["..."],
  "headlines": ["..."],
  "descriptions": ["..."],
  "sitelinks": [
    {{"text": "...", "description1": "...", "description2": "...", "finalUrl": "..."}}
  ],
  "callouts": ["..."],
  "structured_snippets": ["..."],
  "words_to_avoid": ["..."],
  "safer_content_directions": ["..."],
  "sensitive_content_note": "..."
}}
""".strip()


def _extract_gemini_text(data: dict) -> str:
    try:
        parts = data["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Gemini did not return content.") from exc
    text = "".join(str(part.get("text", "")) for part in parts if isinstance(part, dict)).strip()
    if not text:
        raise RuntimeError("Gemini returned empty content.")
    return text


def _parse_json_object(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise RuntimeError("Gemini returned invalid JSON.") from exc
        value = json.loads(match.group(0))
    if not isinstance(value, dict):
        raise RuntimeError("Gemini JSON response must be an object.")
    return value


def _require_items(data: dict, key: str, count: int, limit: int) -> list[str]:
    aliases = {
        "keyword_headlines": ["keywordHeadlines"],
        "structured_snippets": ["structuredSnippets", "structured_snippet", "structuredSnippet"],
        "words_to_avoid": ["wordsToAvoid"],
        "safer_content_directions": ["saferContentDirections"],
    }
    raw = data.get(key)
    for alias in aliases.get(key, []):
        if raw is None:
            raw = data.get(alias)
    if not isinstance(raw, list):
        raise RuntimeError(f"Gemini response missing {key}.")

    items = [_limit(str(item), limit) for item in raw if _compact(str(item))]
    if len(items) < count:
        raise RuntimeError(f"Gemini returned too few {key}.")
    return items[:count]


def _require_sitelinks(data: dict, fallback_url: str) -> list[SitelinkItem]:
    raw = data.get("sitelinks")
    if not isinstance(raw, list) or len(raw) < SITELINK_COUNT:
        raise RuntimeError("Gemini returned too few sitelinks.")

    sitelinks: list[SitelinkItem] = []
    for item in raw[:SITELINK_COUNT]:
        if not isinstance(item, dict):
            raise RuntimeError("Gemini sitelinks must be objects.")
        sitelinks.append(
            SitelinkItem(
                text=_limit(str(item.get("text", "")), SITELINK_TEXT_LIMIT),
                description_1=_limit(str(item.get("description1", "")), SITELINK_DESCRIPTION_LIMIT),
                description_2=_limit(str(item.get("description2", "")), SITELINK_DESCRIPTION_LIMIT),
                final_url=str(item.get("finalUrl") or fallback_url),
            )
        )
    return sitelinks


def _require_text(data: dict, key: str, limit: int) -> str:
    aliases = {"sensitive_content_note": ["sensitiveContentNote"]}
    raw = data.get(key)
    for alias in aliases.get(key, []):
        if raw is None:
            raw = data.get(alias)
    text = _limit_sentence(str(raw or ""), limit)
    if not text:
        raise RuntimeError(f"Gemini response missing {key}.")
    return text


async def _scan_landing_page(url: str) -> LandingPageContent:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
        )
    }
    try:
        async with httpx.AsyncClient(timeout=18.0, follow_redirects=True, trust_env=False) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
        html = response.text
        final_url = str(response.url)
    except (httpx.HTTPError, OSError):
        final_url = url
        html = ""

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    title = _compact(soup.title.string if soup.title else "")
    description = _meta_content(soup, "description") or _meta_content(soup, "og:description")
    headings = _unique_limited(
        [_compact(tag.get_text(" ")) for tag in soup.select("h1, h2, h3")],
        14,
        80,
    )
    paragraphs = _unique_limited(
        [_compact(tag.get_text(" ")) for tag in soup.select("p, li") if len(_compact(tag.get_text(" "))) >= 35],
        12,
        160,
    )
    links = _extract_links(soup, final_url)

    return LandingPageContent(
        url=final_url,
        domain=_domain_label(final_url),
        title=title or None,
        description=description,
        headings=headings,
        paragraphs=paragraphs,
        links=links,
    )


def _extract_links(soup: BeautifulSoup, base_url: str) -> list[tuple[str, str]]:
    links: list[tuple[str, str]] = []
    seen: set[str] = set()
    for tag in soup.select("a[href]"):
        label = _compact(tag.get_text(" "))
        href = tag.get("href")
        if not label or not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        links.append((_limit(label, SITELINK_TEXT_LIMIT), urljoin(base_url, href)))
        if len(links) >= 8:
            break
    return links


def _meta_content(soup: BeautifulSoup, name: str) -> str | None:
    tag = soup.find("meta", attrs={"name": name}) or soup.find("meta", attrs={"property": name})
    if not tag:
        return None
    return _compact(str(tag.get("content") or "")) or None


def _unique_limited(items: list[str], count: int, limit: int) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        text = _limit(_compact(item), limit)
        key = text.lower()
        if text and key not in seen:
            seen.add(key)
            result.append(text)
        if len(result) >= count:
            return result
    return result


def _limit(value: str, limit: int) -> str:
    text = _compact(value)
    if len(text) <= limit:
        return text
    clipped = text[:limit].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    return clipped[:limit].rstrip(" .,;:-")


def _limit_sentence(value: str, limit: int) -> str:
    text = _compact(value)
    if len(text) <= limit:
        return text
    sentence = re.split(r"(?<=[.!?])\s+", text)[0]
    if len(sentence) <= limit:
        return sentence
    return _limit(text, limit)


def _compact(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _normalize_url(value: str) -> str:
    text = value.strip()
    if not re.match(r"^https?://", text, flags=re.IGNORECASE):
        text = f"https://{text}"
    return text


def _domain_label(value: str) -> str:
    parsed = urlparse(value)
    host = (parsed.netloc or parsed.path).split(":")[0]
    host = host.removeprefix("www.")
    return host or "Website"
