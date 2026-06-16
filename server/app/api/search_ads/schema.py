from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.shared.responses import CamelModel


class SearchAdsRequest(CamelModel):
    keyword: str = Field(..., description="Keyword to search Google Ads")
    location: str = Field("Vietnam", description="Geo location")
    language: str = Field("vi", description="Interface language, e.g. vi or en")
    device: str = Field("desktop", description="Device, desktop or mobile")
    no_proxy: bool = Field(True, description="Disable proxy")
    headful: bool = Field(False, description="Open browser UI for debugging")
    proxy_id: str | None = Field(None, description="Saved proxy ID, ignored when no_proxy=True")
    project_id: str | None = Field(None, description="Project ID when searching from a saved project")

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
    id: str | None = None
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
    project_id: str | None = None
    project_name: str | None = None
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
    source: str = "manual"
    project_id: str | None = None
    project_name: str | None = None
    video_url: str | None = None
    video_status: str = "none"
    created_at: str


class SearchAdsHistoryResponse(CamelModel):
    total: int
    items: list[SearchAdsHistoryItem] = Field(default_factory=list)


class SearchAdsScheduleCreate(CamelModel):
    keyword: str = Field(..., description="Keyword to search Google Ads")
    location: str = Field("Vietnam", description="Geo location")
    language: str = Field("vi", description="Interface language")
    device: str = Field("desktop", description="Device")
    no_proxy: bool = Field(True, description="Disable proxy")
    headful: bool = Field(False, description="Open browser UI in worker")
    proxy_id: str | None = Field(None, description="Saved proxy ID when no_proxy=False")
    project_id: str | None = Field(None, description="Project ID when scheduling from a saved project")
    schedule_mode: Literal["once", "daily"] = Field("once", description="Schedule mode")
    run_at: list[datetime] = Field(default_factory=list, description="One-off run datetimes")
    daily_times: list[str] = Field(default_factory=list, description="Daily HH:mm run times")
    notify_telegram_on_change: bool = Field(False, description="Send Telegram when top 1 advertiser changes")

    @model_validator(mode="after")
    def validate_schedule_times(self):
        if self.schedule_mode == "daily":
            if not self.daily_times:
                raise ValueError("daily_times is required when schedule_mode is daily")
            invalid = [value for value in self.daily_times if not _is_valid_daily_time(value)]
            if invalid:
                raise ValueError("daily_times must use HH:mm format")
            return self

        if not self.run_at:
            raise ValueError("run_at is required when schedule_mode is once")
        return self


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
    project_id: str | None = None
    project_name: str | None = None
    batch_id: str | None = None
    schedule_mode: str = "once"
    daily_time: str | None = None
    notify_telegram_on_change: bool = False
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


class SearchAdsCompetitorCreate(CamelModel):
    keyword: str
    source_search_id: str | None = None
    source_ad_id: str | None = None
    position: int | None = None
    title: str | None = None
    snippet: str | None = None
    display_url: str | None = None
    target_url: str | None = None
    advertiser_name: str | None = None
    advertiser_domain: str | None = None
    advertiser_location: str | None = None
    confidence: float = 0.0
    landing_page: LandingPageInfo | None = None


class SearchAdsCompetitorItem(CamelModel):
    id: str
    user_id: str
    keyword: str
    advertiser_name: str
    advertiser_domain: str | None = None
    advertiser_location: str | None = None
    title: str | None = None
    snippet: str | None = None
    display_url: str | None = None
    target_url: str | None = None
    position: int | None = None
    confidence: float = 0.0
    landing_page: LandingPageInfo | None = None
    source_search_id: str | None = None
    source_ad_id: str | None = None
    created_at: str
    updated_at: str


class SearchAdsCompetitorResponse(CamelModel):
    total: int
    items: list[SearchAdsCompetitorItem] = Field(default_factory=list)


def _is_valid_daily_time(value: str) -> bool:
    parts = value.split(":")
    if len(parts) != 2 or any(not part.isdigit() for part in parts):
        return False
    hour, minute = (int(part) for part in parts)
    return 0 <= hour <= 23 and 0 <= minute <= 59
