from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import Field

from app.shared.responses import CamelModel


class AdsTransparencySearchRequest(CamelModel):
    text: str | None = Field(None, description="Domain hoặc tên nhà quảng cáo")
    advertiser_id: str | None = Field(None, description="Advertiser ID dạng 'AR...'")
    platform: str | None = Field(
        None,
        description="Nền tảng: PLAY | MAPS | SEARCH | SHOPPING | YOUTUBE",
    )
    creative_format: str | None = Field(
        None,
        description="Định dạng quảng cáo: TEXT | IMAGE | VIDEO",
    )
    start_date: date | None = Field(None, description="Ngày bắt đầu")
    end_date: date | None = Field(None, description="Ngày kết thúc")
    region: str | None = Field(
        None,
        description="Mã vùng số (vd: '2704' = VN, '2840' = US)",
    )
    political_ads: bool = Field(False, description="Chỉ lấy quảng cáo chính trị")
    num: int = Field(40, ge=1, le=100, description="Số kết quả trả về (1–100)")
    next_page_token: str | None = Field(
        None, description="Token phân trang từ response trước"
    )
    project_id: str | None = Field(None, description="Project ID when searching from a saved project")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "text": "shopee.vn",
                    "platform": "SEARCH",
                    "creative_format": "TEXT",
                    "region": "2704",
                    "num": 40,
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "political_ads": False,
                }
            ]
        }
    }


class AdDetailsRequest(CamelModel):
    advertiser_id: str = Field(..., description="Advertiser ID dạng 'AR...'")
    creative_id: str = Field(..., description="Creative ID dạng 'CR...'")
    region: str | None = Field(
        None,
        description="Mã vùng số (vd: '2704' = VN, '2840' = US)",
    )
    ad_creative_id: str | None = Field(
        None,
        description="UUID nội bộ của AdCreative (tuỳ chọn, dùng để liên kết với bảng ad_creatives)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "advertiser_id": "AR01234567890123456",
                    "creative_id": "CR98765432109876543",
                    "region": "2704",
                }
            ]
        }
    }


class AdsTransparencySearchResponse(CamelModel):
    data: dict[str, Any]


class AdDetailsResponse(CamelModel):
    data: dict[str, Any]


# ---------------------------------------------------------------------------
# GET /history — full nested response per user
# ---------------------------------------------------------------------------

class AdCreativeDetailOut(CamelModel):
    id: str
    ad_creative_id: str | None
    advertiser_id: str
    google_creative_id: str
    format: str | None
    last_shown: int | None
    region_name: str | None
    more_ads_by_advertiser: str | None
    regions: list | None
    ad_creatives: list | None
    created_at: datetime
    updated_at: datetime


class AdCreativeOut(CamelModel):
    id: str
    search_id: str
    advertiser_id: str
    advertiser: str
    ad_creative_id: str
    format: str
    target_domain: str | None
    image: str | None
    link: str | None
    width: int | None
    height: int | None
    total_days_shown: int | None
    first_shown: int | None
    last_shown: int | None
    details_link: str | None
    serpapi_details_link: str | None
    created_at: datetime
    updated_at: datetime
    details: list[AdCreativeDetailOut] = Field(default_factory=list)


class AdSearchHistoryItem(CamelModel):
    id: str
    user_id: str | None
    text: str | None
    advertiser_id_query: str | None
    platform: str | None
    creative_format: str | None
    start_date: date | None
    end_date: date | None
    region: str | None
    political_ads: bool
    num: int
    next_page_token_input: str | None
    project_id: str | None = None
    project_name: str | None = None
    total_results: int | None
    next_page_token_output: str | None
    created_at: datetime
    updated_at: datetime
    creatives: list[AdCreativeOut] = Field(default_factory=list)


class AdSearchHistoryResponse(CamelModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[AdSearchHistoryItem]


# ---------------------------------------------------------------------------
# GET /competitors — paginated competitor groups
# ---------------------------------------------------------------------------

class CompetitorGroupOut(CamelModel):
    advertiser_id: str
    advertiser: str
    first_seen: datetime
    last_seen: datetime
    creatives: list[AdCreativeOut] = Field(default_factory=list)


class CompetitorListResponse(CamelModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[CompetitorGroupOut]
