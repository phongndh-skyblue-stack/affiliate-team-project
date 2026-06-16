from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ScanTrafficRequest(BaseModel):
    affiliate_link_id: str = Field(..., min_length=1, description="ID của affiliate link đã tạo")
    months: int = Field(default=4, ge=1, le=12, description="Số tháng lịch sử cần lấy")


    start_period: str | None = Field(
        default=None,
        pattern=r"^\d{4}-\d{2}$",
        description="Tháng bắt đầu quét, định dạng YYYY-MM",
    )


class TrafficDetails(BaseModel):
    global_: list[dict[str, Any]] = Field(default_factory=list, alias="global")
    country: list[dict[str, Any]] | None = None
    source: dict[str, Any] | None = None
    social: list[dict[str, Any]] | None = None

    model_config = {"populate_by_name": True}


class ScanTrafficResponse(BaseModel):
    domain: str
    url: str
    found: bool
    monthly_visits: int
    period_month: str
    traffic_details: TrafficDetails | None = None


class AffiliateProjectScanRequest(BaseModel):
    affiliate_link_id: str = Field(..., min_length=1, description="ID của affiliate link đã tạo")
    max_results: int = Field(default=10, ge=1, le=20, description="Số kết quả trả về")
    search_depth: Literal["basic", "advanced"] = Field(
        default="advanced",
        description='Mức độ tìm kiếm: "basic" hoặc "advanced"',
    )
    include_raw_content: bool = Field(
        default=True,
        description="Trả về nội dung thô để đối chiếu mức hoa hồng",
    )


class TopCountryInsight(BaseModel):
    country: str
    signal_score: int = 0
    signals: list[str] = Field(default_factory=list)


class EvidenceLink(BaseModel):
    title: str | None = None
    url: str | None = None
    snippet: str | None = None


class RestrictedCountryInsight(BaseModel):
    country: str
    restriction_type: Literal["banned", "restricted"] = "restricted"
    signals: list[str] = Field(default_factory=list)
    evidence_links: list[EvidenceLink] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"] | None = None
    verification_note: str | None = None


class AffiliateProjectScanResponse(BaseModel):
    website: str
    domain: str
    query: str
    project_name: str | None = None
    project_link: str | None = None
    event_content: str | None = None
    sale_content: str | None = None
    restricted_countries: list[RestrictedCountryInsight] = Field(default_factory=list)
    top_countries: list[TopCountryInsight] = Field(default_factory=list)
    answer: str | None = None
    results: list[dict[str, Any]] = Field(default_factory=list)


class AffiliateLinkModel(BaseModel):
    id: str
    user_id: str | None = None
    affiliate_url: str
    domain: str
    name: str | None = None
    search_query: str | None = None
    raw_data: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class AffiliateLinkCreateRequest(BaseModel):
    website: str = Field(..., min_length=1, description="Affiliate link cần tạo/lưu")
    name: str | None = Field(None, description="Project name")
    search: str | None = Field(None, description="Shared search keyword for project-linked searches")


class AffiliateLinkUpdateRequest(BaseModel):
    website: str = Field(..., min_length=1, description="Affiliate link")
    name: str | None = Field(None, description="Project name")
    search: str | None = Field(None, description="Shared search keyword for project-linked searches")


class AffiliateLinkTrafficModel(BaseModel):
    id: str
    affiliate_link_id: str
    found: bool
    monthly_visits: int
    period_month: str
    traffic_details: dict[str, Any] | None = None
    raw_data: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class AffiliateLinkProjectDataModel(BaseModel):
    id: str
    affiliate_link_id: str
    query: str
    project_name: str | None = None
    project_link: str | None = None
    event_content: str | None = None
    sale_content: str | None = None
    restricted_countries: list[RestrictedCountryInsight] = Field(default_factory=list)
    top_countries: list[TopCountryInsight] = Field(default_factory=list)
    answer: str | None = None
    results: list[dict[str, Any]] = Field(default_factory=list)
    raw_data: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class AffiliateLinkDetailResponse(BaseModel):
    affiliate_link: AffiliateLinkModel
    traffic_scans: list[AffiliateLinkTrafficModel] = Field(default_factory=list)
    project_data_scans: list[AffiliateLinkProjectDataModel] = Field(default_factory=list)
