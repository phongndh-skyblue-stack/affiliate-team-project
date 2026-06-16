from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.api.affiliate_data.repository import AffiliateDataRepository
from app.api.ads_transparent.repository import AdsTransparencyRepository
from app.api.ads_transparent.schema import AdDetailsRequest, AdsTransparencySearchRequest
from app.shared.services import get_ad_details, search_ads_transparency


class AdsTransparencyService:
    def __init__(self, db: Session) -> None:
        self.repository = AdsTransparencyRepository(db)

    def list_by_user_id(self, user_id: str):
        return self.repository.list_by_user_id(user_id)

    def list_by_user_id_paginated(
        self, user_id: str, page: int = 1, page_size: int = 10
    ) -> tuple[int, int, list]:
        return self.repository.list_by_user_id_paginated(user_id, page, page_size)

    def delete_search(self, user_id: str, search_id: str) -> bool:
        return self.repository.delete_search(user_id, search_id)

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
        project_name: str | None = None
        if payload.project_id:
            project = AffiliateDataRepository(self.repository.db).get_project_label_by_id_for_user(
                user_id, payload.project_id
            )
            if not project:
                from fastapi import HTTPException

                raise HTTPException(status_code=404, detail="Project not found")
            _, project_name = project

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
        result["project_name"] = project_name
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
