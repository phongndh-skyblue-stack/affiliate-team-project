from __future__ import annotations

from sqlalchemy.orm import Session

from app.api.manual_search.repository import ManualSearchRepository
from app.api.manual_search.schema import CompetitorSearchRequest, CompetitorSearchResponse
from app.shared.services import trace_competitor_ads


class ManualSearchService:
    def __init__(self, db: Session) -> None:
        self.repository = ManualSearchRepository(db)

    def list_by_user_id(self, user_id: str):
        return self.repository.list_by_user_id(user_id)

    async def search_competitor(
        self, user_id: str, payload: CompetitorSearchRequest
    ) -> CompetitorSearchResponse:
        result = await trace_competitor_ads(
            keyword=payload.keyword,
            location=payload.location,
            hl=payload.hl,
            gl=payload.gl,
            num=payload.num,
            no_cache=payload.no_cache,
        )
        self.repository.save_competitor_search(user_id, payload, result)
        return CompetitorSearchResponse(
            keyword=result["keyword"],
            google_url=result.get("google_url", ""),
            total_ads_found=result["total_ads_found"],
            top_ads_count=result["top_ads_count"],
            bottom_ads_count=result["bottom_ads_count"],
            ads=result["ads"],
        )
