from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.manual_search.schema import (
    CompetitorSearchHistoryItem,
    CompetitorSearchHistoryResponse,
    CompetitorSearchRequest,
    CompetitorSearchResponse,
)
from app.api.manual_search.service import ManualSearchService
from app.core.database import get_db
from app.shared.deps import get_current_user

router = APIRouter(
    prefix="/manual-search",
    tags=["Manual Search"],
    # dependencies=[Depends(get_current_user)],
)


def get_service(db: Session = Depends(get_db)) -> ManualSearchService:
    return ManualSearchService(db)


@router.post(
    "/competitor",
    response_model=CompetitorSearchResponse,
    summary="Trace đối thủ qua từ khóa Google Search",
    responses={
        200: {
            "description": "Danh sách paid ads đang hiển thị trên Google cho từ khóa",
            "content": {
                "application/json": {
                    "example": {
                        "keyword": "mua laptop gaming",
                        "google_url": "https://www.google.com/search?q=mua+laptop+gaming",
                        "total_ads_found": 4,
                        "top_ads_count": 3,
                        "bottom_ads_count": 1,
                        "ads": [
                            {
                                "position": "Top 1",
                                "advertiser": "www.thegioididong.com",
                                "title": "Laptop Gaming Giá Tốt",
                                "snippet": "Mua laptop gaming tại TGDĐ...",
                                "link": "https://www.thegioididong.com/laptop-gaming",
                                "sitelinks": ["Laptop ASUS", "Laptop MSI"],
                                "type": "top_ad",
                            }
                        ],
                    }
                }
            },
        }
    },
)
async def search_competitor(
    payload: CompetitorSearchRequest,
    current_user: User = Depends(get_current_user),
    service: ManualSearchService = Depends(get_service),
) -> CompetitorSearchResponse:
    return await service.search_competitor(current_user.id, payload)


@router.get(
    "/history",
    response_model=CompetitorSearchHistoryResponse,
    summary="Lấy lịch sử trace đối thủ của user hiện tại",
)
def get_competitor_search_history(
    current_user: User = Depends(get_current_user),
    service: ManualSearchService = Depends(get_service),
) -> CompetitorSearchHistoryResponse:
    searches = service.list_by_user_id(current_user.id)
    items = [
        CompetitorSearchHistoryItem(
            id=item.id,
            user_id=item.user_id,
            keyword=item.keyword,
            google_url=item.google_url,
            location=item.location,
            hl=item.hl,
            gl=item.gl,
            num=item.num,
            no_cache=item.no_cache,
            total_ads_found=item.total_ads_found,
            top_ads_count=item.top_ads_count,
            bottom_ads_count=item.bottom_ads_count,
            ads=[
                {
                    "position": ad.position,
                    "advertiser": ad.advertiser,
                    "title": ad.title,
                    "snippet": ad.snippet,
                    "link": ad.link,
                    "sitelinks": ad.sitelinks,
                    "type": ad.type,
                    "displayed_link": (ad.raw_data or {}).get(
                        "displayed_link", ad.advertiser
                    ),
                    "tracking_link": (ad.raw_data or {}).get("tracking_link", ""),
                    "source": (ad.raw_data or {}).get("source", ""),
                    "destination_domain": (ad.raw_data or {}).get(
                        "destination_domain", ""
                    ),
                    "destination_path": (ad.raw_data or {}).get(
                        "destination_path", ""
                    ),
                    "ref_parameters": (ad.raw_data or {}).get("ref_parameters", {}),
                    "sitelink_items": (ad.raw_data or {}).get("sitelink_items", []),
                    "advertiser_candidates": (ad.raw_data or {}).get(
                        "advertiser_candidates", []
                    ),
                    "advertiser_lookup_status": (ad.raw_data or {}).get(
                        "advertiser_lookup_status", "not_requested"
                    ),
                }
                for ad in item.ads
            ],
            raw_data=item.raw_data,
            created_at=item.created_at.isoformat(),
            updated_at=item.updated_at.isoformat(),
        )
        for item in searches
    ]
    return CompetitorSearchHistoryResponse(total=len(items), items=items)
