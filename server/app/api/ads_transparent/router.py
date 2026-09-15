from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.ads_transparent.schema import (
    AdDetailsRequest,
    AdDetailsResponse,
    AdSearchHistoryResponse,
    AdSearchHistoryItem,
    AdCreativeOut,
    AdCreativeDetailOut,
    AdsTransparencySearchRequest,
    AdsTransparencySearchResponse,
    CompetitorGroupOut,
    CompetitorListResponse,
)
from app.api.ads_transparent.service import AdsTransparencyService
from app.api.auth.model import User
from app.core.config import settings
from app.core.database import get_db
from app.shared.deps import get_current_user

router = APIRouter(
    prefix="/ads-transparent",
    tags=["Ads Transparent"],
    dependencies=[Depends(get_current_user)],
)


def get_service(db: Session = Depends(get_db)) -> AdsTransparencyService:
    return AdsTransparencyService(db)


@router.post(
    "/search",
    response_model=AdsTransparencySearchResponse,
    summary="Tìm kiếm quảng cáo trên Google Ads Transparency Center",
    responses={
        200: {
            "description": "Danh sách quảng cáo trả về từ SerpAPI",
            "content": {
                "application/json": {
                    "example": {
                        "data": {
                            "search_metadata": {"status": "Success"},
                            "ads": [
                                {
                                    "advertiser_name": "Shopee",
                                    "advertiser_id": "AR01234567890123456",
                                    "creative_id": "CR98765432109876543",
                                    "creative_format": "TEXT",
                                    "platforms": ["SEARCH"],
                                }
                            ],
                            "serpapi_pagination": {"next_page_token": "abc123"},
                        }
                    }
                }
            },
        }
    },
)
async def search_ads(
    payload: AdsTransparencySearchRequest,
    current_user: User = Depends(get_current_user),
    service: AdsTransparencyService = Depends(get_service),
) -> AdsTransparencySearchResponse:
    data = await service.search(current_user.id, payload)
    return AdsTransparencySearchResponse(data=data)


@router.post(
    "/details",
    response_model=AdDetailsResponse,
    summary="Lấy chi tiết một quảng cáo cụ thể",
    responses={
        200: {
            "description": "Chi tiết quảng cáo (title, headline, hình ảnh, video...)",
            "content": {
                "application/json": {
                    "example": {
                        "data": {
                            "advertiser_name": "Shopee",
                            "advertiser_id": "AR01234567890123456",
                            "creative_id": "CR98765432109876543",
                            "title": "Mua sắm online tại Shopee",
                            "headline": "Giảm giá đến 50%",
                            "image_url": "https://example.com/image.jpg",
                        }
                    }
                }
            },
        }
    },
)
async def get_ad_details(
    payload: AdDetailsRequest,
    service: AdsTransparencyService = Depends(get_service),
) -> AdDetailsResponse:
    data = await service.get_details(payload)
    return AdDetailsResponse(data=data)


@router.get(
    "/history",
    response_model=AdSearchHistoryResponse,
    summary="Lấy lịch sử tìm kiếm quảng cáo của user hiện tại có phân trang",
)
def get_user_history(
    page: int = Query(1, ge=1, description="Số trang (bắt đầu từ 1)"),
    page_size: int = Query(settings.PAGE_SIZE, ge=1, le=50, description="Số kết quả mỗi trang"),
    current_user: User = Depends(get_current_user),
    service: AdsTransparencyService = Depends(get_service),
) -> AdSearchHistoryResponse:
    total, total_pages, searches = service.list_by_user_id_paginated(
        current_user.id, page, page_size
    )

    items: list[AdSearchHistoryItem] = []
    for s in searches:
        creatives = [
            AdCreativeOut(
                id=c.id,
                search_id=c.search_id,
                advertiser_id=c.advertiser_id,
                advertiser=c.advertiser,
                ad_creative_id=c.ad_creative_id,
                format=c.format,
                target_domain=c.target_domain,
                image=c.image,
                link=c.link,
                width=c.width,
                height=c.height,
                total_days_shown=c.total_days_shown,
                first_shown=c.first_shown,
                last_shown=c.last_shown,
                details_link=c.details_link,
                serpapi_details_link=c.serpapi_details_link,
                created_at=c.created_at,
                updated_at=c.updated_at,
                details=[
                    AdCreativeDetailOut(
                        id=d.id,
                        ad_creative_id=d.ad_creative_id,
                        advertiser_id=d.advertiser_id,
                        google_creative_id=d.google_creative_id,
                        format=d.format,
                        last_shown=d.last_shown,
                        region_name=d.region_name,
                        more_ads_by_advertiser=d.more_ads_by_advertiser,
                        regions=d.regions,
                        ad_creatives=d.ad_creatives,
                        created_at=d.created_at,
                        updated_at=d.updated_at,
                    )
                    for d in c.details
                ],
            )
            for c in s.creatives
        ]
        items.append(
            AdSearchHistoryItem(
                id=s.id,
                user_id=s.user_id,
                text=s.text,
                advertiser_id_query=s.advertiser_id_query,
                platform=s.platform,
                creative_format=s.creative_format,
                start_date=s.start_date,
                end_date=s.end_date,
                region=s.region,
                political_ads=s.political_ads,
                num=s.num,
                next_page_token_input=s.next_page_token_input,
                project_id=s.project_id,
                project_name=s.project_name,
                total_results=s.total_results,
                next_page_token_output=s.next_page_token_output,
                created_at=s.created_at,
                updated_at=s.updated_at,
                creatives=creatives,
            )
        )

    return AdSearchHistoryResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )


@router.get(
    "/competitors",
    response_model=CompetitorListResponse,
    summary="Danh sách đối thủ (gom theo advertiser_id) có phân trang",
)
def get_competitors(
    page: int = Query(1, ge=1, description="Số trang (bắt đầu từ 1)"),
    page_size: int = Query(settings.PAGE_SIZE, ge=1, le=50, description="Số đối thủ mỗi trang"),
    current_user: User = Depends(get_current_user),
    service: AdsTransparencyService = Depends(get_service),
) -> CompetitorListResponse:
    data = service.get_competitors(current_user.id, page, page_size)

    items: list[CompetitorGroupOut] = []
    for g in data["items"]:
        creatives = [
            AdCreativeOut(
                id=c.id,
                search_id=c.search_id,
                advertiser_id=c.advertiser_id,
                advertiser=c.advertiser,
                ad_creative_id=c.ad_creative_id,
                format=c.format,
                target_domain=c.target_domain,
                image=c.image,
                link=c.link,
                width=c.width,
                height=c.height,
                total_days_shown=c.total_days_shown,
                first_shown=c.first_shown,
                last_shown=c.last_shown,
                details_link=c.details_link,
                serpapi_details_link=c.serpapi_details_link,
                created_at=c.created_at,
                updated_at=c.updated_at,
                details=[
                    AdCreativeDetailOut(
                        id=d.id,
                        ad_creative_id=d.ad_creative_id,
                        advertiser_id=d.advertiser_id,
                        google_creative_id=d.google_creative_id,
                        format=d.format,
                        last_shown=d.last_shown,
                        region_name=d.region_name,
                        more_ads_by_advertiser=d.more_ads_by_advertiser,
                        regions=d.regions,
                        ad_creatives=d.ad_creatives,
                        created_at=d.created_at,
                        updated_at=d.updated_at,
                    )
                    for d in c.details
                ],
            )
            for c in g["creatives"]
        ]
        items.append(
            CompetitorGroupOut(
                advertiser_id=g["advertiser_id"],
                advertiser=g["advertiser"],
                first_seen=g["first_seen"],
                last_seen=g["last_seen"],
                creatives=creatives,
            )
        )

    return CompetitorListResponse(
        total=data["total"],
        page=data["page"],
        page_size=data["page_size"],
        total_pages=data["total_pages"],
        items=items,
    )


@router.delete(
    "/history/{search_id}",
    summary="Xoá một lịch sử tìm kiếm quảng cáo",
)
def delete_user_history(
    search_id: str,
    current_user: User = Depends(get_current_user),
    service: AdsTransparencyService = Depends(get_service),
) -> dict:
    success = service.delete_search(current_user.id, search_id)
    if not success:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy lịch sử quét hoặc không thuộc về bạn",
        )
    return {"success": True}
