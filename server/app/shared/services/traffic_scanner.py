"""SimilarWeb Pro — traffic scanner.

Quét chi tiết traffic của 1 domain qua widgetApi (4 endpoints × N tháng).
Public entry point: ``scan_traffic(url, months=4) -> dict``
"""
from __future__ import annotations

import asyncio
import logging
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

from app.shared.services import similarweb as sw

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SW_BASE = "https://pro.similarweb.com/widgetApi"
_TIMEOUT = 30.0
_DEFAULT_MONTHS = 4
_SECOND_LEVEL_CC_TLDS = {
    "co.uk",
    "org.uk",
    "gov.uk",
    "ac.uk",
    "com.au",
    "net.au",
    "org.au",
    "co.jp",
    "ne.jp",
    "or.jp",
    "com.sg",
    "com.my",
    "com.br",
    "com.mx",
    "com.tr",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_domain(url: str) -> str:
    """Bóc domain không www, không port từ URL bất kỳ."""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = parsed.netloc or parsed.path.split("/")[0]
    host = host.removeprefix("www.").split(":")[0].strip().lower()
    if not host:
        return ""

    parts = [p for p in host.split(".") if p]
    if len(parts) <= 2:
        return host

    suffix2 = ".".join(parts[-2:])
    suffix3 = ".".join(parts[-3:])
    if suffix2 in _SECOND_LEVEL_CC_TLDS:
        return suffix3
    return suffix2


def _sw_date(dt: datetime) -> str:
    """Format SimilarWeb: YYYY|MM|DD."""
    return f"{dt.year}|{dt.month:02d}|{dt.day:02d}"


def _share_percentage(value: Any) -> float:
    share = float(value or 0)
    if 0 < share <= 1:
        share *= 100
    return round(share, 2)


def _scan_months(n: int = _DEFAULT_MONTHS) -> list[tuple[datetime, datetime]]:
    """Trả list (from_dt, to_dt) cho N tháng gần nhất, skip tháng hiện tại.

    SimilarWeb thường delay ~1 tháng nên skip tháng hiện tại.
    """
    now = datetime.now(timezone.utc)
    # cuối tháng trước
    base = datetime(now.year, now.month, 1, tzinfo=timezone.utc) - timedelta(days=1)
    months: list[tuple[datetime, datetime]] = []
    for _ in range(n):
        y, m = base.year, base.month
        last = monthrange(y, m)[1]
        months.append(
            (
                datetime(y, m, 1, tzinfo=timezone.utc),
                datetime(y, m, last, tzinfo=timezone.utc),
            )
        )
        base = datetime(y, m, 1, tzinfo=timezone.utc) - timedelta(days=1)
    return list(reversed(months))  # cũ → mới


def _scan_months_from_period(
    n: int,
    start_period: str,
) -> list[tuple[datetime, datetime]]:
    now = datetime.now(timezone.utc)
    previous_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc) - timedelta(days=1)
    latest_complete = datetime(previous_month.year, previous_month.month, 1, tzinfo=timezone.utc) - timedelta(days=1)
    latest_month = datetime(latest_complete.year, latest_complete.month, 1, tzinfo=timezone.utc)
    try:
        y_text, m_text = start_period.split("-", 1)
        y, m = int(y_text), int(m_text)
        base = datetime(y, m, 1, tzinfo=timezone.utc)
    except (TypeError, ValueError) as exc:
        raise ValueError("start_period must be in YYYY-MM format") from exc

    if base > latest_month:
        base = latest_month

    months: list[tuple[datetime, datetime]] = []
    for offset in range(n):
        month_index = base.month - 1 + offset
        y = base.year + month_index // 12
        m = month_index % 12 + 1
        if (y, m) > (latest_complete.year, latest_complete.month):
            break
        last = monthrange(y, m)[1]
        months.append(
            (
                datetime(y, m, 1, tzinfo=timezone.utc),
                datetime(y, m, last, tzinfo=timezone.utc),
            )
        )
    return months

async def _get_widget(
    url: str,
    params: dict[str, Any],
    headers: dict[str, str],
) -> tuple[Any, dict[str, str], int]:
    """GET widgetApi với auto-retry khi 401/403 (cookie expire)."""
    print(f"==========> Calling SimilarWeb API: {url}")
    print(f"==========> Params: {params}")
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, trust_env=False) as c:
            r = await c.get(url, params=params, headers=headers)
    except (httpx.RequestError, OSError) as exc:
        logger.warning("Gọi SimilarWeb thất bại (%s): %s", type(exc).__name__, exc)
        return None, headers, 0

    if r.status_code in (401, 403):
        logger.warning("SimilarWeb cookie hết hạn (%d), đang refresh...", r.status_code)
        await sw.refresh_cookie(stale_cookie=headers.get("cookie"))
        headers = await sw.get_headers()
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT, trust_env=False) as c:
                r = await c.get(url, params=params, headers=headers)
        except (httpx.RequestError, OSError) as exc:
            logger.warning(
                "Gọi SimilarWeb sau refresh cookie vẫn thất bại (%s): %s",
                type(exc).__name__,
                exc,
            )
            return None, headers, 0

    if r.status_code == 400:
        validation_error = r.headers.get("SW-Validation-error", "")
        if validation_error.lower() == "interval":
            logger.warning(
                "SimilarWeb từ chối interval from=%s to=%s (endpoint=%s)",
                params.get("from"),
                params.get("to"),
                url,
            )
            # Không phải no-data domain; đánh dấu là lỗi interval để caller retry/fallback.
            return None, headers, 422

    if r.status_code != 200:
        return None, headers, r.status_code

    try:
        return r.json(), headers, 200
    except Exception:
        return None, headers, 200


# ---------------------------------------------------------------------------
# 4 endpoint fetchers
# ---------------------------------------------------------------------------


async def _fetch_global(
    domain: str,
    from_dt: datetime,
    to_dt: datetime,
    headers: dict[str, str],
) -> list[dict[str, Any]]:
    """Engagement overview — total visits, unique, pages/visit, bounce rate."""
    url = f"{_SW_BASE}/WebsiteOverview/EngagementOverview/Table"
    params = {
        "country": 999,
        "from": _sw_date(from_dt),
        "to": _sw_date(to_dt),
        "includeSubDomains": "true",
        "isWindow": "false",
        "timeGranularity": "Monthly",
        "keys": domain,
        "webSource": "Total",
        "ignoreFilterConsistency": "false",
        "ShouldGetVerifiedData": "false",
    }

    data, headers, status = await _get_widget(url, params, headers)

    if status == 400:
        logger.info("Domain %r không có dữ liệu SimilarWeb (400)", domain)
        return []
    if status == 422:
        logger.warning(
            "Bỏ qua tháng %s do interval không hợp lệ khi quét domain %r",
            from_dt.strftime("%Y-%m"),
            domain,
        )
        return None
    if data is None:
        if status == 0:
            return None
        return []

    out: list[dict[str, Any]] = []
    for row in data.get("Data") or []:
        vpu = float(row.get("VisitsPerUser") or 0)
        uu = float(row.get("UniqueUsers") or 0)
        dedup = float(row.get("DedupUniqueUsers") or 0)
        avgm = float(row.get("AvgMonthVisits") or 0)
        total = round(vpu * uu) if vpu and uu else 0
        repeat = round(uu - dedup) if uu >= dedup else 0
        out.append(
            {
                "period_month": from_dt.strftime("%Y-%m"),
                "total_visits_monthly": total,
                "avg_visits_monthly": round(avgm),
                "unique_visits_monthly": round(uu),
                "repeat_visits_monthly": repeat,
                "pages_per_visit": round(float(row.get("PagesPerVisit") or 0), 2),
                "avg_visit_duration": round(float(row.get("AvgVisitDuration") or 0)),
                "bounce_rate_percentage": round(
                    float(row.get("BounceRate") or 0) * 100, 2
                ),
            }
        )
    return out


async def _fetch_country(
    domain: str,
    from_dt: datetime,
    to_dt: datetime,
    headers: dict[str, str],
    global_total: int = 0,
) -> list[dict[str, Any]]:
    """Top-50 quốc gia theo traffic share."""
    url = f"{_SW_BASE}/WebsiteGeographyExtended/GeographyExtended/Table"
    params = {
        "country": 999,
        "from": _sw_date(from_dt),
        "to": _sw_date(to_dt),
        "includeSubDomains": "true",
        "isWindow": "false",
        "timeGranularity": "Monthly",
        "keys": domain,
        "webSource": "Total",
        "page": 1,
        "pageSize": 50,
        "includeRegionalDomains": "false",
    }

    data, _, status = await _get_widget(url, params, headers)
    if data is None:
        return []

    # Build country_map từ Filters
    country_map: dict[int, tuple[str, str]] = {}
    for cf in (data.get("Filters") or {}).get("country") or []:
        try:
            cid = int(cf.get("id"))
            icon = cf.get("icon", "")
            code = icon.split("flag-")[-1].upper() if "flag-" in icon else ""
            country_map[cid] = (cf.get("text", f"Country-{cid}"), code)
        except (TypeError, ValueError):
            continue

    out: list[dict[str, Any]] = []
    for row in data.get("Data") or []:
        cid = row.get("Country")
        share = float(row.get("Share") or 0)
        name, code = country_map.get(int(cid), (f"Country-{cid}", "")) if cid else ("Unknown", "")
        total_visits = round(global_total * share) if global_total and share else None
        out.append(
            {
                "country_code": code,
                "country_name": name,
                "traffic_share_percentage": round(share * 100, 2),
                "total_visits_monthly": total_visits,
                "pages_per_visit": round(float(row.get("PagePerVisit") or 0), 2),
                "avg_visit_duration": round(float(row.get("AvgVisitDuration") or 0)),
                "bounce_rate_percentage": round(
                    float(row.get("BounceRate") or 0) * 100, 2
                ),
            }
        )
    return out


async def _fetch_sources(
    domain: str,
    from_dt: datetime,
    to_dt: datetime,
    headers: dict[str, str],
) -> dict[str, Any] | None:
    """Traffic sources breakdown (pie: organic, paid, social, email, direct, ...)."""
    url = f"{_SW_BASE}/MarketingMixTotal/TrafficSourcesOverview/PieChart"
    params = {
        "country": 999,
        "from": _sw_date(from_dt),
        "to": _sw_date(to_dt),
        "includeSubDomains": "true",
        "isWindow": "false",
        "timeGranularity": "Monthly",
        "keys": domain,
    }

    data, _, status = await _get_widget(url, params, headers)
    if data is None:
        return None

    total = (data.get("Data") or {}).get("Total") or {}
    domain_total = total.get(domain) or {}
    return {
        "period_month": from_dt.strftime("%Y-%m"),
        "organic_search": _share_percentage(domain_total.get("Organic Search")),
        "social": _share_percentage(domain_total.get("Social")),
        "email": _share_percentage(domain_total.get("Email")),
        "display_ads": _share_percentage(domain_total.get("Display Ads")),
        "direct": _share_percentage(domain_total.get("Direct")),
        "referrals": _share_percentage(domain_total.get("Referrals")),
        "paid_search": _share_percentage(domain_total.get("Paid Search")),
    }


async def _fetch_social(
    domain: str,
    from_dt: datetime,
    to_dt: datetime,
    headers: dict[str, str],
) -> list[dict[str, Any]] | None:
    """Social traffic breakdown (pie per platform)."""
    url = f"{_SW_BASE}/WebsiteOverviewDesktop/TrafficSourcesSocial/PieChart"
    params = {
        "country": 999,
        "from": _sw_date(from_dt),
        "to": _sw_date(to_dt),
        "includeSubDomains": "true",
        "isWindow": "false",
        "timeGranularity": "Monthly",
        "keys": domain,
        "webSource": "Desktop",  # QUAN TRỌNG: Desktop, không phải Total
    }

    data, _, status = await _get_widget(url, params, headers)
    if data is None:
        return None

    domain_data = (data.get("Data") or {}).get(domain)
    if not domain_data:
        return None

    out: list[dict[str, Any]] = []
    for platform, pdata in domain_data.items():
        share = pdata.get("Share") if isinstance(pdata, dict) else pdata
        out.append(
            {
                "platform_name": platform,
                "share_percentage": float(share) if share is not None else None,
            }
        )
    return out


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


async def _scan_one_month(
    domain: str,
    from_dt: datetime,
    to_dt: datetime,
    headers: dict[str, str],
) -> tuple[
    list[dict] | None,
    list[dict] | None,
    dict | None,
    list[dict] | None,
]:
    """Quét 1 tháng: global trước (cần total cho country), 3 cái còn lại parallel."""
    g = await _fetch_global(domain, from_dt, to_dt, headers)
    if g == []:
        # domain không có SW data
        return [], None, None, None
    if g is None:
        return None, None, None, None

    total = (g[0].get("total_visits_monthly") if g else 0) or 0

    results = await asyncio.gather(
        _fetch_country(domain, from_dt, to_dt, headers, global_total=total),
        _fetch_sources(domain, from_dt, to_dt, headers),
        _fetch_social(domain, from_dt, to_dt, headers),
        return_exceptions=True,
    )

    def _norm(v: Any) -> Any:
        return None if isinstance(v, Exception) else v

    c, s, so = _norm(results[0]), _norm(results[1]), _norm(results[2])
    return g, c, s, so


async def scan_traffic(
    url: str,
    months: int = _DEFAULT_MONTHS,
    start_period: str | None = None,
) -> list[dict[str, Any]]:
    """Quét traffic chi tiết của 1 URL từ SimilarWeb Pro.

    Returns:
        list[dict] với keys: domain, found, monthly_visits, period_month, traffic_details
    """
    domain = _extract_domain(url)
    if not domain:
        raise ValueError(f"Không thể xác định domain từ URL: {url!r}")

    logger.info("Bắt đầu quét traffic: domain=%r, months=%d", domain, months)

    headers = await sw.get_headers()

    results: list[dict[str, Any]] = []
    failed: list[tuple[datetime, datetime]] = []

    month_ranges = _scan_months_from_period(months, start_period) if start_period else _scan_months(months)

    # Pass 1
    for from_dt, to_dt in month_ranges:
        try:
            g, c, s, so = await _scan_one_month(domain, from_dt, to_dt, headers)
            if g == []:
                # domain không có data SW — dừng sớm
                break
            if g:
                period_month = from_dt.strftime("%Y-%m")
                monthly_visits = int(g[0].get("total_visits_monthly") or 0)
                details: dict[str, Any] = {"global": g}
                if c: details["country"] = c
                if s: details["source"] = s
                if so: details["social"] = so
                
                results.append({
                    "monthly_visits": monthly_visits,
                    "period_month": period_month,
                    "domain": domain,
                    "found": True,
                    "traffic_details": details,
                })
            else:
                failed.append((from_dt, to_dt))
        except Exception as exc:
            logger.warning("Lỗi quét tháng %s: %s", from_dt.strftime("%Y-%m"), exc)
            failed.append((from_dt, to_dt))

    # Pass 2 — retry các tháng thất bại nếu nhiều hơn 1
    if len(failed) > 1:
        logger.info("Retry %d tháng thất bại sau khi refresh cookie", len(failed))
        try:
            await sw.refresh_cookie(stale_cookie=headers.get("cookie"))
            headers = await sw.get_headers()
            for from_dt, to_dt in failed:
                try:
                    g, c, s, so = await _scan_one_month(domain, from_dt, to_dt, headers)
                    if g:
                        period_month = from_dt.strftime("%Y-%m")
                        monthly_visits = int(g[0].get("total_visits_monthly") or 0)
                        details = {"global": g}
                        if c: details["country"] = c
                        if s: details["source"] = s
                        if so: details["social"] = so
                        
                        results.append({
                            "monthly_visits": monthly_visits,
                            "period_month": period_month,
                            "domain": domain,
                            "found": True,
                            "traffic_details": details,
                        })
                except Exception as exc:
                    logger.warning("Retry thất bại tháng %s: %s", from_dt.strftime("%Y-%m"), exc)
        except Exception as exc:
            logger.error("Refresh cookie cho retry thất bại: %s", exc)

    if not results:
        latest_period = month_ranges[-1][0].strftime("%Y-%m") if month_ranges else ""
        results.append({
            "monthly_visits": 0,
            "period_month": latest_period,
            "domain": domain,
            "found": False,
            "traffic_details": None,
        })

    logger.info(
        "Quét traffic xong: domain=%r, lấy được %d tháng",
        domain,
        len(results),
    )

    return results
