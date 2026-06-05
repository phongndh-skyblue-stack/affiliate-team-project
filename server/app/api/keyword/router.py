from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, status

from app.api.keyword.service import (
    discover_similarweb_keyword_endpoints,
    fetch_similarweb_website_keywords,
)

router = APIRouter(prefix="/keyword", tags=["Keyword Test"])


@router.get(
    "/similarweb/website-keywords/test",
    summary="Test SimilarWeb Website Explorer keywords, no auth",
)
async def test_similarweb_website_keywords(
    domain: str = Query(..., min_length=1, description="Domain cần đọc, ví dụ blofin.com"),
    country: int = Query(999, description="SimilarWeb country id, 999 = Worldwide"),
    duration: str = Query("3m", pattern=r"^\d+m$", description="Khoảng thời gian SimilarWeb, ví dụ 3m"),
    traffic_source: Literal["all", "organic", "paid"] = Query("all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    raw: bool = Query(False, description="Trả raw response để debug endpoint SimilarWeb"),
    endpoint: str | None = Query(
        None,
        description="Widget endpoint override, ví dụ SearchKeywords/WebsiteKeywordV2/Table",
    ),
) -> dict[str, Any]:
    try:
        return await fetch_similarweb_website_keywords(
            domain=domain.strip(),
            country=country,
            duration=duration,
            traffic_source=traffic_source,
            page=page,
            page_size=page_size,
            raw=raw,
            endpoint=endpoint,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get(
    "/similarweb/discover-keyword-endpoints/test",
    summary="Discover SimilarWeb keyword widget endpoints from current JS bundle, no auth",
)
async def discover_keyword_endpoints() -> dict[str, Any]:
    try:
        return await discover_similarweb_keyword_endpoints()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
