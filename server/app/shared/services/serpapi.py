"""SerpAPI service — Google Ads Transparency Center.

Docs: https://serpapi.com/google-ads-transparency-center-api
Tất cả hàm đều async và tự xoay key khi gặp 429 / quota hết.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import parse_qsl, urlparse

import httpx

from app.core.config import settings
from app.shared.services._key_pool import KeyPool

logger = logging.getLogger(__name__)

_SERPAPI_URL = "https://serpapi.com/search"

_pool: KeyPool | None = None


def _get_pool() -> KeyPool:
    global _pool
    if _pool is None:
        _pool = KeyPool(settings.serpapi_keys, name="SerpAPI")
    return _pool


async def _request(params: dict[str, Any]) -> dict[str, Any]:
    """Gửi request đến SerpAPI, tự xoay key khi bị 429."""
    pool = _get_pool()
    pool.reset_tried()

    while not pool.all_tried:
        pool.mark_current_tried()
        key = pool.current

        try:
            async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
                resp = await client.get(_SERPAPI_URL, params={**params, "api_key": key})

            if resp.status_code == 429:
                logger.warning("SerpAPI quota hết cho key ...%s, đang xoay...", key[-6:])
                await pool.rotate()
                continue

            resp.raise_for_status()
            return resp.json()

        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                logger.warning("SerpAPI quota hết cho key ...%s, đang xoay...", key[-6:])
                await pool.rotate()
                continue
            logger.error("SerpAPI HTTP error %d: %s", exc.response.status_code, exc.response.text)
            raise

        except httpx.RequestError as exc:
            logger.error("SerpAPI request error: %s", exc)
            raise

    raise RuntimeError(
        "Tất cả SerpAPI keys đã hết quota. Vui lòng thêm key mới vào SERPAPI_KEYS."
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def search_ads_transparency(
    text: str | None = None,
    advertiser_id: str | None = None,
    platform: str | None = None,
    creative_format: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    region: str | None = None,
    political_ads: bool = False,
    num: int = 40,
    next_page_token: str | None = None,
) -> dict[str, Any]:
    """Tìm kiếm quảng cáo trên Google Ads Transparency Center.

    Args:
        text:             Domain hoặc tên nhà quảng cáo (query).
        advertiser_id:    Advertiser ID dạng "AR...".
        platform:         PLAY | MAPS | SEARCH | SHOPPING | YOUTUBE.
        creative_format:  TEXT | IMAGE | VIDEO.
        start_date:       Ngày bắt đầu YYYYMMDD.
        end_date:         Ngày kết thúc YYYYMMDD.
        region:           Mã vùng, ví dụ "VN", "US".
        political_ads:    Chỉ lấy quảng cáo chính trị.
        num:              Số kết quả trả về (tối đa 100).
        next_page_token:  Token phân trang từ response trước.
    """
    params: dict[str, Any] = {"engine": "google_ads_transparency_center"}

    if text:
        params["text"] = text
    if advertiser_id:
        params["advertiser_id"] = advertiser_id
    if platform:
        params["platform"] = platform.upper()
    if creative_format:
        params["creative_format"] = creative_format.lower()
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date
    if region:
        params["region"] = region
    if political_ads:
        params["political_ads"] = "true"

    params["num"] = min(num, 100)

    if next_page_token:
        params["next_page_token"] = next_page_token

    return await _request(params)


async def get_ad_details(
    advertiser_id: str,
    creative_id: str,
    region: str | None = None,
) -> dict[str, Any]:
    """Lấy chi tiết một quảng cáo cụ thể (title, headline, hình ảnh, video...).

    Args:
        advertiser_id: Advertiser ID dạng "AR...".
        creative_id:   Creative ID dạng "CR...".
        region:        Mã vùng, ví dụ "VN", "US".
    """
    params: dict[str, Any] = {
        "engine": "google_ads_transparency_center_ad_details",
        "advertiser_id": advertiser_id,
        "creative_id": creative_id,
    }

    if region:
        params["region"] = region

    return await _request(params)


async def trace_competitor_ads(
    keyword: str,
    location: str = "Vietnam",
    hl: str = "vi",
    gl: str = "vn",
    num: int = 10,
    no_cache: bool = False,
    enrich_advertisers: bool = True,
) -> dict[str, Any]:
    """Trace đối thủ: Nhập keyword → Trả về tất cả paid ads đang hiển thị trên Google.

    Args:
        keyword:   Từ khóa cần tìm.
        location:  Vị trí địa lý, mặc định "Vietnam".
        hl:        Ngôn ngữ giao diện (vi, en...).
        gl:        Mã quốc gia (vn, us...).
        num:       Số kết quả organic (ảnh hưởng số ads hiển thị).
        no_cache:  Bỏ qua cache SerpAPI, dùng khi debug.

    Returns:
        Dict gồm:
            - keyword, total_ads_found, top_ads_count, bottom_ads_count
            - ads: list các quảng cáo đã được làm sạch
            - full_raw_data: raw response (chỉ có khi no_cache=True)
    """
    params: dict[str, Any] = {
        "engine": "google",
        "q": keyword,
        "num": num,
        "location": location,
        "hl": hl,
        "gl": gl,
        "device": "desktop",
    }
    if no_cache:
        params["no_cache"] = "true"

    data = await _request(params)

    def _clean_ad(ad: dict[str, Any], position_prefix: str, ad_type: str) -> dict[str, Any]:
        link = ad.get("link") or ""
        parsed_link = urlparse(link)
        query_params = dict(parse_qsl(parsed_link.query, keep_blank_values=True))
        ref_params = {
            key: value
            for key, value in query_params.items()
            if any(
                marker in key.lower()
                for marker in ("ref", "aff", "affiliate", "partner", "campaign", "utm_")
            )
        }
        sitelink_items = [
            {
                "title": item.get("title") or "",
                "link": item.get("link") or "",
                "tracking_link": item.get("tracking_link") or "",
                "snippet": item.get("snippet") or "",
            }
            for item in (ad.get("sitelinks") or [])
        ]
        return {
            "position": f"{position_prefix} {ad.get('position', 'N/A')}",
            "advertiser": ad.get("displayed_link", "N/A"),
            "title": ad.get("title", ""),
            "snippet": ad.get("snippet") or ad.get("description") or "",
            "link": link,
            "displayed_link": ad.get("displayed_link") or "",
            "tracking_link": ad.get("tracking_link") or "",
            "source": ad.get("source") or "",
            "destination_domain": parsed_link.hostname or "",
            "destination_path": parsed_link.path or "",
            "ref_parameters": ref_params,
            "sitelinks": [item["title"] for item in sitelink_items],
            "sitelink_items": sitelink_items,
            "advertiser_candidates": [],
            "advertiser_lookup_status": "not_requested",
            "type": ad_type,
        }

    top_ads: list[dict[str, Any]] = data.get("ads", [])
    bottom_ads: list[dict[str, Any]] = data.get("bottom_ads", [])

    all_ads = [_clean_ad(ad, "Top", "top_ad") for ad in top_ads] + [
        _clean_ad(ad, "Bottom", "bottom_ad") for ad in bottom_ads
    ]

    if enrich_advertisers:
        await _enrich_competitor_advertisers(all_ads, gl)

    return {
        "keyword": keyword,
        "google_url": data.get("search_metadata", {}).get("google_url", ""),
        "total_ads_found": len(all_ads),
        "top_ads_count": len(top_ads),
        "bottom_ads_count": len(bottom_ads),
        "ads": all_ads,
        "full_raw_data": data if no_cache else None,
    }


_TRANSPARENCY_REGION_BY_GL = {
    "au": "2036",
    "ca": "2124",
    "jp": "2392",
    "kr": "2410",
    "sg": "2702",
    "uk": "2826",
    "us": "2840",
    "vn": "2704",
}

_COUNTRY_NAME_BY_GL = {
    "au": "Australia",
    "ca": "Canada",
    "jp": "Nhật Bản",
    "kr": "Hàn Quốc",
    "sg": "Singapore",
    "uk": "Vương quốc Anh",
    "us": "Hoa Kỳ",
    "vn": "Việt Nam",
}


async def _enrich_competitor_advertisers(
    ads: list[dict[str, Any]],
    gl: str,
) -> None:
    """Add transparency advertiser candidates once per unique destination domain."""
    domain_results: dict[str, list[dict[str, Any]]] = {}
    domain_statuses: dict[str, str] = {}
    region = _TRANSPARENCY_REGION_BY_GL.get(gl.lower())

    for ad in ads:
        domain = (ad.get("destination_domain") or "").lower().removeprefix("www.")
        if not domain:
            ad["advertiser_lookup_status"] = "missing_domain"
            continue

        if domain not in domain_results:
            try:
                response = await search_ads_transparency(
                    text=domain,
                    platform="SEARCH",
                    region=region,
                    num=10,
                )
                candidates = []
                seen: set[tuple[str, str]] = set()
                for creative in response.get("ad_creatives") or []:
                    key = (
                        creative.get("advertiser_id") or "",
                        creative.get("ad_creative_id") or "",
                    )
                    if key in seen:
                        continue
                    seen.add(key)
                    candidates.append(
                        {
                            "advertiser_id": creative.get("advertiser_id") or "",
                            "paid_for_by": creative.get("advertiser") or "",
                            "creative_id": creative.get("ad_creative_id") or "",
                            "format": creative.get("format") or "",
                            "target_domain": creative.get("target_domain") or "",
                            "first_shown": creative.get("first_shown"),
                            "last_shown": creative.get("last_shown"),
                            "total_days_shown": creative.get("total_days_shown"),
                            "details_link": creative.get("details_link") or "",
                            "advertiser_ads_link": (
                                f"https://adstransparency.google.com/advertiser/"
                                f"{creative.get('advertiser_id')}"
                                f"?region={gl.upper()}&domain={domain}&platform=SEARCH"
                            ),
                            "display_region": _COUNTRY_NAME_BY_GL.get(
                                gl.lower(), gl.upper()
                            ),
                        }
                    )
                domain_results[domain] = candidates
                domain_statuses[domain] = "matched" if candidates else "not_found"
            except Exception:
                logger.exception("Cannot enrich advertiser transparency for %s", domain)
                domain_results[domain] = []
                domain_statuses[domain] = "failed"

        ad["advertiser_candidates"] = domain_results[domain]
        ad["advertiser_lookup_status"] = domain_statuses[domain]
