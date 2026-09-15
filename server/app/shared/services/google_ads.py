from __future__ import annotations

import traceback
from decimal import Decimal
from typing import Optional
from urllib.parse import urlparse

from app.core.config import settings


def _build_client(refresh_token: str, login_customer_id: str | None = None):
    """Build a GoogleAdsClient using per-user refresh_token and shared OAuth credentials."""
    try:
        from google.ads.googleads.client import GoogleAdsClient  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "google-ads package is not installed. Run: pip install google-ads>=24.0.0"
        ) from exc

    credentials: dict = {
        "developer_token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "use_proto_plus": True,
    }
    if login_customer_id:
        credentials["login_customer_id"] = login_customer_id

    return GoogleAdsClient.load_from_dict(credentials)


def get_keyword_ideas(
    keywords: list[str],
    refresh_token: str,
    customer_id: str,
    login_customer_id: str | None = None,
    page_url: Optional[str] = None,
    language_id: int = 1000,
    location_ids: Optional[list[int]] = None,
    limit: Optional[int] = 500,
) -> list[dict]:
    """Fetch keyword ideas from Google Ads Keyword Planner using seed keywords and/or a page URL.

    Args:
        keywords: Seed keywords.
        refresh_token: Per-mail OAuth2 refresh token from DB.
        customer_id: Google Ads customer ID to bill against (the imported account).
        login_customer_id: MCC parent ID to set as login_customer_id (for sub-accounts).
        page_url: Optional URL to combine with keywords.
        language_id: Language criterion ID (1000 = English, 1019 = Vietnamese).
        location_ids: Geo-target criterion IDs. Empty list = all locations.
        limit: Max number of ideas to return (None = unlimited).

    Returns:
        List of keyword idea dicts.
    """
    from google.ads.googleads.v21.enums.types.keyword_plan_network import (  # type: ignore
        KeywordPlanNetworkEnum,
    )

    client = _build_client(refresh_token, login_customer_id)
    keyword_plan_idea_service = client.get_service("KeywordPlanIdeaService")
    google_ads_service = client.get_service("GoogleAdsService")

    request = client.get_type("GenerateKeywordIdeasRequest")
    request.customer_id = customer_id
    request.language = google_ads_service.language_constant_path(language_id)
    if location_ids:
        request.geo_target_constants.extend(
            google_ads_service.geo_target_constant_path(loc_id)
            for loc_id in location_ids
        )
    request.keyword_plan_network = (
        KeywordPlanNetworkEnum.KeywordPlanNetwork.GOOGLE_SEARCH
    )

    if keywords and page_url:
        seed = client.get_type("KeywordAndUrlSeed")
        seed.url = page_url
        seed.keywords.extend(keywords)
        request.keyword_and_url_seed = seed
    elif keywords:
        seed = client.get_type("KeywordSeed")
        seed.keywords.extend(keywords)
        request.keyword_seed = seed
    elif page_url:
        seed = client.get_type("UrlSeed")
        seed.url = page_url
        request.url_seed = seed
    else:
        raise ValueError("Must provide at least keywords or page_url.")

    ideas: list[dict] = []
    try:
        response = keyword_plan_idea_service.generate_keyword_ideas(request)
        for result in response.results:
            ideas.append(_parse_idea(result))
            if limit is not None and len(ideas) >= limit:
                break
    except Exception:
        traceback.print_exc()
        raise

    return ideas


def get_keyword_ideas_from_url(
    page_url: str,
    refresh_token: str,
    customer_id: str,
    login_customer_id: str | None = None,
    use_entire_site: bool = True,
    language_id: int = 1000,
    location_ids: Optional[list[int]] = None,
    limit: Optional[int] = 500,
) -> list[dict]:
    """Fetch keyword ideas from Keyword Planner using a URL (page or entire site).

    Args:
        page_url: URL to scan.
        refresh_token: Per-mail OAuth2 refresh token from DB.
        customer_id: Google Ads customer ID to use.
        login_customer_id: MCC parent ID (for sub-accounts).
        use_entire_site: If True, use SiteSeed (domain); if False, use UrlSeed (single page).
        language_id: Language criterion ID.
        location_ids: Geo-target criterion IDs. Empty = all locations.
        limit: Max number of ideas to return.

    Returns:
        List of keyword idea dicts.
    """
    from google.ads.googleads.v21.enums.types.keyword_plan_network import (  # type: ignore
        KeywordPlanNetworkEnum,
    )

    if not page_url:
        raise ValueError("page_url is required.")

    client = _build_client(refresh_token, login_customer_id)
    keyword_plan_idea_service = client.get_service("KeywordPlanIdeaService")
    google_ads_service = client.get_service("GoogleAdsService")

    request = client.get_type("GenerateKeywordIdeasRequest")
    request.customer_id = customer_id
    request.language = google_ads_service.language_constant_path(language_id)
    if location_ids:
        request.geo_target_constants.extend(
            google_ads_service.geo_target_constant_path(loc_id)
            for loc_id in location_ids
        )
    request.keyword_plan_network = (
        KeywordPlanNetworkEnum.KeywordPlanNetwork.GOOGLE_SEARCH
    )

    if use_entire_site:
        parsed = urlparse(page_url)
        domain = parsed.netloc or parsed.path
        if not domain:
            raise ValueError(f"Cannot extract domain from URL: {page_url}")
        seed = client.get_type("SiteSeed")
        seed.site = domain
        request.site_seed = seed
    else:
        seed = client.get_type("UrlSeed")
        seed.url = page_url
        request.url_seed = seed

    ideas: list[dict] = []
    try:
        response = keyword_plan_idea_service.generate_keyword_ideas(request)
        for result in response.results:
            ideas.append(_parse_idea(result))
            if limit is not None and len(ideas) >= limit:
                break
    except Exception:
        traceback.print_exc()
        raise

    return ideas


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_idea(result) -> dict:
    """Convert a GenerateKeywordIdeasResult proto to a plain dict."""
    metrics = result.keyword_idea_metrics

    monthly_data: list[dict] = []
    for ms in metrics.monthly_search_volumes:
        monthly_data.append(
            {
                "year": ms.year,
                "month": ms.month,
                "searches": ms.monthly_searches or 0,
            }
        )
    monthly_data.sort(key=lambda x: (x["year"], x["month"]))
    if len(monthly_data) > 12:
        monthly_data = monthly_data[-12:]

    comp_level = (
        metrics.competition.name.lower() if metrics.competition else "unknown"
    )
    comp_label = {
        "low": "Thấp",
        "medium": "Trung bình",
        "high": "Cao",
        "unknown": "Không xác định",
    }.get(comp_level, "Không xác định")

    low_bid = (
        float(Decimal(getattr(metrics, "low_top_of_page_bid_micros", 0) or 0) / Decimal(1_000_000))
        if hasattr(metrics, "low_top_of_page_bid_micros")
        else None
    )
    high_bid = (
        float(Decimal(getattr(metrics, "high_top_of_page_bid_micros", 0) or 0) / Decimal(1_000_000))
        if hasattr(metrics, "high_top_of_page_bid_micros")
        else None
    )

    return {
        "keyword": result.text,
        "avg_monthly_searches": metrics.avg_monthly_searches or 0,
        "competition": comp_label,
        "competition_index": getattr(metrics, "competition_index", None),
        "low_top_page_bid": low_bid,
        "high_top_page_bid": high_bid,
        "monthly_searches": monthly_data,
    }


# ---------------------------------------------------------------------------
# Mail Delegation — account scanning
# ---------------------------------------------------------------------------


def get_accounts_for_delegation(refresh_token: str) -> dict:
    """Scan all Google Ads accounts accessible via a delegated user's refresh_token.

    Builds a GoogleAdsClient using the user's personal OAuth token (not the
    system-wide keyword planner credentials).  Returns a flat list of accounts
    (each has manager_account_ads_id so the caller can build a tree) plus a list
    of customer IDs that could not be fetched.

    Args:
        refresh_token: The delegated user's Google OAuth2 refresh_token.

    Returns:
        {
            "accounts": [
                {
                    "ads_id": str,
                    "ads_name": str,
                    "ads_status": str,          # "enabled" / "cancelled" / etc.
                    "currency_code": str,
                    "timezone": str,
                    "is_manager": bool,
                    "manager_account_ads_id": str,  # "" for root accounts
                }
            ],
            "unaccessible_ids": [str, ...],     # IDs that raised API errors
        }
    """
    try:
        from google.ads.googleads.errors import GoogleAdsException  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "google-ads package is not installed. Run: pip install google-ads>=24.0.0"
        ) from exc

    client = _build_client(refresh_token)

    customer_service = client.get_service("CustomerService")
    try:
        accessible = customer_service.list_accessible_customers()
        root_ids: list[str] = [rn.split("/")[-1] for rn in accessible.resource_names]
    except GoogleAdsException as exc:
        raise RuntimeError(f"Failed to list accessible customers: {exc}") from exc

    if not root_ids:
        return {"accounts": [], "unaccessible_ids": []}

    ga_service = client.get_service("GoogleAdsService")
    all_accounts: list[dict] = []
    unaccessible_ids: list[str] = []
    seen_ids: set[str] = set()

    for root_id in root_ids:
        # --- Fetch root customer info ---
        try:
            query = (
                "SELECT customer.id, customer.descriptive_name, customer.status,"
                " customer.currency_code, customer.time_zone, customer.manager"
                " FROM customer"
            )
            for row in ga_service.search(customer_id=root_id, query=query):
                c = row.customer
                cid = str(c.id)
                if cid not in seen_ids:
                    seen_ids.add(cid)
                    all_accounts.append(
                        {
                            "ads_id": cid,
                            "ads_name": c.descriptive_name,
                            "ads_status": _status_name(c.status),
                            "currency_code": c.currency_code,
                            "timezone": c.time_zone,
                            "is_manager": bool(c.manager),
                            "manager_account_ads_id": "",
                        }
                    )
        except Exception:
            unaccessible_ids.append(root_id)
            continue

        # --- Fetch managed sub-accounts (customer_client) if this is MCC ---
        try:
            hierarchy_query = (
                "SELECT customer_client.id, customer_client.descriptive_name,"
                " customer_client.status, customer_client.currency_code,"
                " customer_client.time_zone, customer_client.manager,"
                " customer_client.level"
                " FROM customer_client"
                " WHERE customer_client.level > 0"
            )
            for row in ga_service.search(customer_id=root_id, query=hierarchy_query):
                cc = row.customer_client
                sub_id = str(cc.id)
                if sub_id not in seen_ids:
                    seen_ids.add(sub_id)
                    all_accounts.append(
                        {
                            "ads_id": sub_id,
                            "ads_name": cc.descriptive_name,
                            "ads_status": _status_name(cc.status),
                            "currency_code": cc.currency_code,
                            "timezone": cc.time_zone,
                            "is_manager": bool(cc.manager),
                            "manager_account_ads_id": root_id,
                        }
                    )
        except Exception:
            pass  # Not a manager account or no sub-accounts — skip silently

    # Fetch budget info for each account
    for acc in all_accounts:
        acc.update(_fetch_account_budget(ga_service, acc["ads_id"]))

    return {"accounts": all_accounts, "unaccessible_ids": unaccessible_ids}


def _status_name(status_enum) -> str:
    """Convert proto enum to lowercase string, fall back to 'unknown'."""
    try:
        return status_enum.name.lower()
    except AttributeError:
        return "unknown"


def _fetch_account_budget(ga_service, customer_id: str) -> dict:
    """Fetch the most recent approved account_budget for a customer.

    Returns dict with budget_paid, budget_used, budget_adjustment (all float or None).
    """
    try:
        query = (
            "SELECT account_budget.approved_spending_limit_micros,"
            " account_budget.amount_served_micros,"
            " account_budget.total_adjustments_micros"
            " FROM account_budget"
            " WHERE account_budget.status = 'APPROVED'"
            " LIMIT 1"
        )
        for row in ga_service.search(customer_id=customer_id, query=query):
            ab = row.account_budget

            def _micros(v) -> "float | None":
                return float(Decimal(v) / Decimal(1_000_000)) if v else None

            return {
                "budget_paid": _micros(getattr(ab, "approved_spending_limit_micros", 0)),
                "budget_used": _micros(getattr(ab, "amount_served_micros", 0)),
                "budget_adjustment": _micros(getattr(ab, "total_adjustments_micros", 0)),
            }
    except Exception:
        pass
    return {"budget_paid": None, "budget_used": None, "budget_adjustment": None}
