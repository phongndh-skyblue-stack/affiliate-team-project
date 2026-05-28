from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.api.ads_transparent.repository import AdsTransparencyRepository
from app.api.ads_transparent.schema import AdDetailsRequest, AdsTransparencySearchRequest
from app.shared.services import get_ad_details, search_ads_transparency


class AdsTransparencyService:
    def __init__(self, db: Session) -> None:
        self.repository = AdsTransparencyRepository(db)

    def list_by_user_id(self, user_id: str):
        return self.repository.list_by_user_id(user_id)

    def get_competitors(
        self, user_id: str, page: int = 1, page_size: int = 10
    ) -> dict:
        total, total_pages, groups = self.repository.list_competitors_paginated(
            user_id, page, page_size
        )
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "items": groups,
        }

    async def search(self, user_id: str, payload: AdsTransparencySearchRequest) -> dict[str, Any]:
        result = await search_ads_transparency(
            text=payload.text,
            advertiser_id=payload.advertiser_id,
            platform=payload.platform,
            creative_format=payload.creative_format,
            start_date=payload.start_date.strftime("%Y%m%d") if payload.start_date else None,
            end_date=payload.end_date.strftime("%Y%m%d") if payload.end_date else None,
            region=payload.region,
            political_ads=payload.political_ads,
            num=payload.num,
            next_page_token=payload.next_page_token,
        )
        self.repository.save_search(user_id, payload, result)
        return result

    async def get_details(self, payload: AdDetailsRequest) -> dict[str, Any]:
        result = await get_ad_details(
            advertiser_id=payload.advertiser_id,
            creative_id=payload.creative_id,
            region=payload.region,
        )
        self.repository.save_detail(payload, result)
        return result
