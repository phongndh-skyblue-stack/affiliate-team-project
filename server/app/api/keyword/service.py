from __future__ import annotations

import re
from typing import Any

import httpx

from app.shared.services import similarweb as sw

_SW_BASE = "https://pro.similarweb.com/widgetApi"
_TIMEOUT = 30.0

_WEBSITE_KEYWORD_ENDPOINTS = [
    "SearchKeywords/WebsiteKeywordV2/Table",
    "OrganicSearch/WebsiteKeywordV2/Table",
    "OrganicSearchKeywords/WebsiteKeywordV2/Table",
    "SearchKeywordAnalysis/WebsiteKeywordV2/Table",
    "KeywordResearch/WebsiteKeywordV2/Table",
    "SearchKeywords/PageAnalysis/Table",
    "OrganicSearch/PageAnalysis/Table",
    "OrganicSearchKeywords/PageAnalysis/Table",
    "SearchKeywordsAnalysis/PageAnalysis/Table",
    "SearchKeywordsAnalysis/PageAnalysis/WebsiteKeywordV2/Table",
    "SearchKeywords/PageAnalysis/WebsiteKeywordV2/Table",
    "OrganicSearch/PageAnalysis/WebsiteKeywordV2/Table",
    "KeywordAnalysis/WebsiteKeywordV2/Table",
    "OrganicSearchKeywords/WebsiteKeywords/Table",
    "SearchKeywords/WebsiteKeywords/Table",
    "SearchKeywords/Keywords/Table",
    "WebsiteOrganicSearch/WebsiteKeywords/Table",
    "WebsiteKeywords/Keywords/Table",
]

_KEYWORD_DISCOVERY_PATTERNS = [
    "website-keyword-v2",
    "WebsiteKeyword",
    "WebsiteKeywords",
    "KeywordV2",
    "PageAnalysis",
    "organicsearch",
]


async def fetch_similarweb_website_keywords(
    *,
    domain: str,
    country: int = 999,
    duration: str = "3m",
    traffic_source: str = "all",
    page: int = 1,
    page_size: int = 100,
    raw: bool = False,
    endpoint: str | None = None,
) -> dict[str, Any]:
    headers = await sw.get_headers()
    page_url = (
        "https://pro.similarweb.com/#/organicsearch/pageAnalysis/"
        f"website-keyword-v2/*/{country}/{duration}?key={domain}"
    )
    headers = {
        **headers,
        "referer": page_url,
        "x-sw-page": page_url,
    }
    params = _build_params(
        domain=domain,
        country=country,
        duration=duration,
        traffic_source=traffic_source,
        page=page,
        page_size=page_size,
    )
    attempts: list[dict[str, Any]] = []

    endpoints = [endpoint.strip("/")] if endpoint else _WEBSITE_KEYWORD_ENDPOINTS

    for endpoint_name in endpoints:
        url = f"{_SW_BASE}/{endpoint_name}"
        data, headers, status = await _get_widget(url, params, headers)
        attempts.append(
            {
                "endpoint": endpoint_name,
                "status": status,
                "has_data": _has_table_data(data),
                "error": _extract_error(data),
            }
        )
        if status == 200 and data is not None:
            countries = _extract_countries(data)
            rows = _extract_rows(data)
            if raw:
                return {
                    "domain": domain,
                    "country": country,
                    "duration": duration,
                    "traffic_source": traffic_source,
                    "endpoint": endpoint_name,
                    "url": url,
                    "params": params,
                    "attempts": attempts,
                    "raw": data,
                }
            return {
                "domain": domain,
                "country": country,
                "duration": duration,
                "traffic_source": traffic_source,
                "endpoint": endpoint_name,
                "attempts": attempts,
                "countries": countries,
                "total_countries": len(countries),
                "keywords": [_normalize_keyword_row(row) for row in rows],
                "total_keywords": len(rows),
            }

    return {
        "domain": domain,
        "country": country,
        "duration": duration,
        "traffic_source": traffic_source,
        "endpoint": None,
        "attempts": attempts,
        "countries": [],
        "total_countries": 0,
        "keywords": [],
        "total_keywords": 0,
    }


async def discover_similarweb_keyword_endpoints() -> dict[str, Any]:
    headers = await sw.get_headers()
    async with httpx.AsyncClient(timeout=_TIMEOUT, trust_env=False) as client:
        home = await client.get("https://pro.similarweb.com/", headers=headers)
        if home.status_code in (401, 403):
            await sw.refresh_cookie(stale_cookie=headers.get("cookie"))
            headers = await sw.get_headers()
            home = await client.get("https://pro.similarweb.com/", headers=headers)

        html = home.text
        assets = _extract_js_assets(html)
        scanned: list[dict[str, Any]] = []
        snippets: list[dict[str, str]] = []
        endpoint_candidates: set[str] = set()

        for asset in assets[:20]:
            asset_url = asset if asset.startswith("http") else f"https://pro.similarweb.com{asset}"
            response = await client.get(asset_url, headers=headers)
            scanned.append({"asset": asset_url, "status": response.status_code, "size": len(response.text)})
            if response.status_code != 200:
                continue
            text = response.text
            for pattern in _KEYWORD_DISCOVERY_PATTERNS:
                for match in re.finditer(re.escape(pattern), text, flags=re.IGNORECASE):
                    start = max(0, match.start() - 240)
                    end = min(len(text), match.end() + 240)
                    snippet = text[start:end]
                    snippets.append(
                        {
                            "asset": asset_url,
                            "pattern": pattern,
                            "snippet": snippet,
                        }
                    )
                    endpoint_candidates.update(_extract_widget_candidates(snippet))
                    if len(snippets) >= 80:
                        break
                if len(snippets) >= 80:
                    break

        return {
            "home_status": home.status_code,
            "assets": assets,
            "scanned": scanned,
            "endpoint_candidates": sorted(endpoint_candidates),
            "snippets": snippets,
        }


def _build_params(
    *,
    domain: str,
    country: int,
    duration: str,
    traffic_source: str,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    source = traffic_source.lower()
    if source == "organic":
        organic_filter = "Organic"
    elif source == "paid":
        organic_filter = "Paid"
    else:
        organic_filter = "All"

    return {
        "country": country,
        "duration": duration,
        "keys": domain,
        "key": domain,
        "webSource": "Total",
        "includeSubDomains": "true",
        "isWindow": "false",
        "timeGranularity": "Monthly",
        "organicPaid": organic_filter,
        "trafficSource": organic_filter,
        "page": page,
        "pageSize": page_size,
        "from": page_size * max(page - 1, 0),
        "to": page_size,
    }


def _extract_js_assets(html: str) -> list[str]:
    assets = set(re.findall(r"""src=["']([^"']+\.js(?:\?[^"']*)?)["']""", html, flags=re.IGNORECASE))
    assets.update(re.findall(r"""href=["']([^"']+\.js(?:\?[^"']*)?)["']""", html, flags=re.IGNORECASE))
    return sorted(assets)


def _extract_widget_candidates(text: str) -> set[str]:
    candidates: set[str] = set()
    for match in re.finditer(r"""widgetApi/([^"'`\s?#]+)""", text):
        candidates.add(match.group(1).strip("/"))
    for match in re.finditer(r"""["']([A-Za-z0-9_/.-]*(?:Keyword|Keywords|PageAnalysis|OrganicSearch)[A-Za-z0-9_/.-]*)["']""", text):
        value = match.group(1).strip("/")
        if "/" in value and len(value) < 160:
            candidates.add(value)
    return candidates


async def _get_widget(
    url: str,
    params: dict[str, Any],
    headers: dict[str, str],
) -> tuple[Any, dict[str, str], int]:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, trust_env=False) as client:
            response = await client.get(url, params=params, headers=headers)
    except (httpx.RequestError, OSError):
        return None, headers, 0

    if response.status_code in (401, 403):
        await sw.refresh_cookie(stale_cookie=headers.get("cookie"))
        headers = await sw.get_headers()
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT, trust_env=False) as client:
                response = await client.get(url, params=params, headers=headers)
        except (httpx.RequestError, OSError):
            return None, headers, 0

    if response.status_code != 200:
        try:
            return response.json(), headers, response.status_code
        except ValueError:
            return {"text": response.text[:1000]}, headers, response.status_code

    try:
        return response.json(), headers, response.status_code
    except ValueError:
        return {"text": response.text[:1000]}, headers, response.status_code


def _extract_error(data: Any) -> str | None:
    if isinstance(data, dict):
        for key in ("error", "Error", "message", "Message"):
            value = data.get(key)
            if value:
                return str(value)
    return None


def _has_table_data(data: Any) -> bool:
    return bool(_extract_rows(data) or _extract_countries(data))


def _extract_countries(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        return []
    filters = data.get("Filters") or data.get("filters") or {}
    countries = filters.get("country") or filters.get("countries") or []
    out: list[dict[str, Any]] = []
    for item in countries:
        if not isinstance(item, dict):
            continue
        icon = str(item.get("icon") or item.get("Icon") or "")
        out.append(
            {
                "id": item.get("id") or item.get("Id") or item.get("value"),
                "name": item.get("text") or item.get("Text") or item.get("name"),
                "code": icon.split("flag-")[-1].upper() if "flag-" in icon else item.get("code"),
                "icon": icon or None,
                "is_locked": bool(item.get("isLocked") or item.get("locked") or item.get("is_locked") or False),
            }
        )
    return out


def _extract_rows(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if not isinstance(data, dict):
        return []

    candidates = [
        data.get("Data"),
        data.get("data"),
        data.get("Records"),
        data.get("records"),
        data.get("Rows"),
        data.get("rows"),
    ]
    for candidate in candidates:
        if isinstance(candidate, list):
            return [item for item in candidate if isinstance(item, dict)]
        if isinstance(candidate, dict):
            nested = _extract_rows(candidate)
            if nested:
                return nested

    for value in data.values():
        nested = _extract_rows(value)
        if nested:
            return nested
    return []


def _first(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
    lowered = {key.lower(): value for key, value in row.items()}
    for key in keys:
        value = lowered.get(key.lower())
        if value not in (None, ""):
            return value
    return None


def _normalize_keyword_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "keyword": _first(row, "Keyword", "SearchTerm", "Name", "keyword"),
        "volume": _first(row, "Volume", "SearchVolume", "Search Volume", "volume"),
        "cpc": _first(row, "Cpc", "CPC", "CpcUsd", "cpc"),
        "traffic_share": _first(row, "TrafficShare", "Share", "traffic_share"),
        "organic_share": _first(row, "Organic", "OrganicShare", "organic_share"),
        "paid_share": _first(row, "Paid", "PaidShare", "paid_share"),
        "change": _first(row, "Change", "ChangePercentage", "change"),
        "url": _first(row, "Url", "URL", "LandingPage", "DestinationUrl", "url"),
        "raw": row,
    }
