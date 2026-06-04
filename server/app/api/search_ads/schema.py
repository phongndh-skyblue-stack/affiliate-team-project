from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.shared.responses import CamelModel


class SearchAdsRequest(CamelModel):
    keyword: str = Field(..., description="Từ khóa cần tìm quảng cáo")
    location: str = Field("Vietnam", description="Vị trí địa lý")
    language: str = Field("vi", description="Ngôn ngữ giao diện (vi, en...)")
    device: str = Field("desktop", description="Thiết bị (desktop, mobile)")
    no_proxy: bool = Field(True, description="Không dùng proxy (True khi test local)")
    headful: bool = Field(False, description="Mở browser có giao diện (debug)")
    proxy_id: str | None = Field(None, description="ID proxy đã lưu để sử dụng (bỏ qua khi no_proxy=True)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "keyword": "xm trading",
                    "location": "Vietnam",
                    "language": "vi",
                    "device": "desktop",
                    "no_proxy": True,
                    "headful": False,
                }
            ]
        }
    }


class LandingPageInfo(CamelModel):
    original_url: str | None = None
    final_url: str | None = None
    domain: str | None = None
    redirect_chain: list[str] = Field(default_factory=list)
    status: str | None = None
    error: str | None = None
    final_status_code: int | None = None


class SearchAdItem(CamelModel):
    position: int
    title: str | None = None
    snippet: str | None = None
    display_url: str | None = None
    target_url: str | None = None
    advertiser_name: str | None = None
    advertiser_domain: str | None = None
    advertiser_location: str | None = None
    confidence: float = 0.0
    source: str | None = None
    landing_page: LandingPageInfo | None = None


class OrganicLinkItem(CamelModel):
    title: str | None = None
    url: str | None = None


class SearchAdsResponse(CamelModel):
    id: str | None = None
    keyword: str
    search_url: str | None = None
    status: str
    total_ads_found: int
    ads: list[SearchAdItem] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    organic_links: list[OrganicLinkItem] = Field(default_factory=list)
    final_summary: str | None = None
    video_url: str | None = None
    video_status: str = "none"


class SearchAdsHistoryItem(CamelModel):
    id: str
    user_id: str | None = None
    keyword: str
    location: str
    language: str
    device: str
    search_url: str | None = None
    status: str
    total_ads_found: int
    errors: list[str] = Field(default_factory=list)
    ads: list[SearchAdItem] = Field(default_factory=list)
    organic_links: list[OrganicLinkItem] = Field(default_factory=list)
    final_summary: str | None = None
    proxy_name: str | None = None
    is_scheduled: bool = False
    video_url: str | None = None
    video_status: str = "none"
    created_at: str


class SearchAdsHistoryResponse(CamelModel):
    total: int
    items: list[SearchAdsHistoryItem] = Field(default_factory=list)


class SearchAdsScheduleCreate(CamelModel):
    keyword: str = Field(..., description="Từ khóa cần tìm quảng cáo")
    location: str = Field("Vietnam", description="Vị trí địa lý")
    language: str = Field("vi", description="Ngôn ngữ giao diện")
    device: str = Field("desktop", description="Thiết bị")
    no_proxy: bool = Field(True, description="Không dùng proxy")
    headful: bool = Field(False, description="Mở browser có giao diện khi worker chạy")
    proxy_id: str | None = Field(None, description="ID proxy đã lưu để dùng khi no_proxy=False")
    run_at: list[datetime] = Field(..., min_length=1, description="Danh sách mốc thời gian cần chạy")


class SearchAdsScheduleItem(CamelModel):
    id: str
    user_id: str | None = None
    keyword: str
    location: str
    language: str
    device: str
    no_proxy: bool
    headful: bool
    proxy_id: str | None = None
    proxy_name: str | None = None
    batch_id: str | None = None
    run_at: str
    status: str
    arq_job_id: str | None = None
    search_id: str | None = None
    error: str | None = None
    created_at: str
    updated_at: str


class SearchAdsScheduleResponse(CamelModel):
    total: int
    items: list[SearchAdsScheduleItem] = Field(default_factory=list)
