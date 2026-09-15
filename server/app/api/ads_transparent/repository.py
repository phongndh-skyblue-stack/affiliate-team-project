from __future__ import annotations

import math
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.ads_transparent.model import AdCreative, AdCreativeDetail, AdTransparencySearch
from app.api.ads_transparent.schema import AdDetailsRequest, AdsTransparencySearchRequest


class AdsTransparencyRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def save_search(
        self,
        user_id: str,
        payload: AdsTransparencySearchRequest,
        response: dict[str, Any],
    ) -> AdTransparencySearch:
        pagination = response.get("serpapi_pagination") or {}
        search_info = response.get("search_information") or {}

        search = AdTransparencySearch(
            user_id=user_id,
            text=payload.text,
            advertiser_id_query=payload.advertiser_id,
            platform=payload.platform,
            creative_format=payload.creative_format,
            start_date=payload.start_date,
            end_date=payload.end_date,
            region=payload.region,
            political_ads=payload.political_ads,
            num=payload.num,
            next_page_token_input=payload.next_page_token,
            project_id=payload.project_id,
            project_name=response.get("project_name"),
            total_results=search_info.get("total_results"),
            next_page_token_output=pagination.get("next_page_token"),
            raw_data=response,
        )
        self.db.add(search)
        self.db.flush()

        for ad in response.get("ad_creatives") or []:
            creative = AdCreative(
                search_id=search.id,
                advertiser_id=ad.get("advertiser_id") or "",
                advertiser=ad.get("advertiser") or "",
                ad_creative_id=ad.get("ad_creative_id") or "",
                format=ad.get("format") or "",
                target_domain=ad.get("target_domain"),
                image=ad.get("image"),
                link=ad.get("link"),
                width=ad.get("width"),
                height=ad.get("height"),
                total_days_shown=ad.get("total_days_shown"),
                first_shown=ad.get("first_shown"),
                last_shown=ad.get("last_shown"),
                details_link=ad.get("details_link"),
                serpapi_details_link=ad.get("serpapi_details_link"),
                raw_data=ad,
            )
            self.db.add(creative)

        self.db.commit()
        self.db.refresh(search)
        return search

    def get_by_id(self, search_id: str) -> AdTransparencySearch | None:
        return self.db.get(AdTransparencySearch, search_id)

    def list_searches(self, skip: int = 0, limit: int = 20) -> list[AdTransparencySearch]:
        stmt = (
            select(AdTransparencySearch)
            .order_by(AdTransparencySearch.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(self.db.scalars(stmt))

    def list_by_user_id(self, user_id: str) -> list[AdTransparencySearch]:
        stmt = (
            select(AdTransparencySearch)
            .where(AdTransparencySearch.user_id == user_id)
            .order_by(AdTransparencySearch.created_at.desc())
        )
        return list(self.db.scalars(stmt))

    def list_by_user_id_paginated(
        self, user_id: str, page: int = 1, page_size: int = 10
    ) -> tuple[int, int, list[AdTransparencySearch]]:
        stmt = (
            select(AdTransparencySearch)
            .where(AdTransparencySearch.user_id == user_id)
        )
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        total_pages = math.ceil(total / page_size) if total > 0 else 0

        offset = (page - 1) * page_size
        paginated_stmt = stmt.order_by(AdTransparencySearch.created_at.desc()).offset(offset).limit(page_size)
        items = list(self.db.scalars(paginated_stmt))
        return total, total_pages, items

    def delete_search(self, user_id: str, search_id: str) -> bool:
        stmt = select(AdTransparencySearch).where(
            AdTransparencySearch.id == search_id,
            AdTransparencySearch.user_id == user_id
        )
        search = self.db.scalar(stmt)
        if not search:
            return False
        self.db.delete(search)
        self.db.commit()
        return True

    def list_competitors_paginated(
        self, user_id: str, page: int = 1, page_size: int = 10
    ) -> tuple[int, int, list[dict]]:
        """Return (total_advertisers, total_pages, page_items) for the competitors view."""
        # Subquery: distinct advertisers from this user's searches
        subq = (
            select(
                AdCreative.advertiser_id,
                AdCreative.advertiser,
                func.max(AdCreative.created_at).label("last_seen"),
                func.min(AdCreative.created_at).label("first_seen"),
            )
            .join(AdTransparencySearch, AdCreative.search_id == AdTransparencySearch.id)
            .where(AdTransparencySearch.user_id == user_id)
            .group_by(AdCreative.advertiser_id, AdCreative.advertiser)
            .order_by(func.max(AdCreative.created_at).desc())
        ).subquery()

        total: int = self.db.scalar(select(func.count()).select_from(subq)) or 0
        total_pages = math.ceil(total / page_size) if total > 0 else 0

        offset = (page - 1) * page_size
        rows = self.db.execute(select(subq).offset(offset).limit(page_size)).all()

        result: list[dict] = []
        for row in rows:
            creatives = list(
                self.db.scalars(
                    select(AdCreative)
                    .join(
                        AdTransparencySearch,
                        AdCreative.search_id == AdTransparencySearch.id,
                    )
                    .where(
                        AdTransparencySearch.user_id == user_id,
                        AdCreative.advertiser_id == row.advertiser_id,
                    )
                    .order_by(AdCreative.created_at.desc())
                )
            )
            result.append(
                {
                    "advertiser_id": row.advertiser_id,
                    "advertiser": row.advertiser,
                    "first_seen": row.first_seen,
                    "last_seen": row.last_seen,
                    "creatives": creatives,
                }
            )

        return total, total_pages, result

    def list_creatives_by_search(self, search_id: str) -> list[AdCreative]:
        stmt = select(AdCreative).where(AdCreative.search_id == search_id)
        return list(self.db.scalars(stmt))

    def save_detail(
        self,
        payload: AdDetailsRequest,
        response: dict[str, Any],
    ) -> AdCreativeDetail:
        search_info = response.get("search_information") or {}

        # Resolve FK: use provided UUID or look up by Google creative id
        ad_creative_id = payload.ad_creative_id
        if ad_creative_id is None:
            linked = self.db.scalar(
                select(AdCreative).where(AdCreative.ad_creative_id == payload.creative_id)
            )
            ad_creative_id = linked.id if linked else None

        detail = AdCreativeDetail(
            ad_creative_id=ad_creative_id,
            advertiser_id=payload.advertiser_id,
            google_creative_id=payload.creative_id,
            format=search_info.get("format"),
            last_shown=search_info.get("last_shown"),
            region_name=search_info.get("region_name"),
            more_ads_by_advertiser=search_info.get("more_ads_by_advertiser"),
            regions=search_info.get("regions"),
            ad_creatives=response.get("ad_creatives"),
            raw_data=response,
        )
        self.db.add(detail)
        self.db.commit()
        self.db.refresh(detail)
        return detail
