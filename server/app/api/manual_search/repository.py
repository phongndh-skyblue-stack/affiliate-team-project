from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.manual_search.model import ManualCompetitorSearch, ManualCompetitorSearchAd
from app.api.manual_search.schema import CompetitorSearchRequest


class ManualSearchRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def save_competitor_search(
        self,
        user_id: str,
        payload: CompetitorSearchRequest,
        response: dict[str, Any],
    ) -> ManualCompetitorSearch:
        search = ManualCompetitorSearch(
            user_id=user_id,
            keyword=response.get("keyword") or payload.keyword,
            google_url=response.get("google_url") or "",
            location=payload.location,
            hl=payload.hl,
            gl=payload.gl,
            num=payload.num,
            no_cache=payload.no_cache,
            project_id=payload.project_id,
            project_name=response.get("project_name"),
            total_ads_found=response.get("total_ads_found") or 0,
            top_ads_count=response.get("top_ads_count") or 0,
            bottom_ads_count=response.get("bottom_ads_count") or 0,
            raw_data=response.get("full_raw_data"),
        )
        self.db.add(search)
        self.db.flush()

        for ad in response.get("ads") or []:
            self.db.add(
                ManualCompetitorSearchAd(
                    search_id=search.id,
                    position=ad.get("position") or "",
                    advertiser=ad.get("advertiser") or "",
                    title=ad.get("title") or "",
                    snippet=ad.get("snippet") or "",
                    link=ad.get("link") or "",
                    sitelinks=ad.get("sitelinks") or [],
                    type=ad.get("type") or "",
                    raw_data=ad,
                )
            )

        self.db.commit()
        self.db.refresh(search)
        return search

    def list_by_user_id(self, user_id: str) -> list[ManualCompetitorSearch]:
        stmt = (
            select(ManualCompetitorSearch)
            .options(selectinload(ManualCompetitorSearch.ads))
            .where(ManualCompetitorSearch.user_id == user_id)
            .order_by(ManualCompetitorSearch.created_at.desc())
        )
        return list(self.db.scalars(stmt))
