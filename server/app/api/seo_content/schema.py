from __future__ import annotations

from datetime import datetime
from pydantic import Field
from app.shared.responses import CamelModel


class SeoContentCreate(CamelModel):
    project_name: str | None = Field(None, description="Name of the affiliate project")
    final_url: str | None = Field(None, description="Target final URL")
    display_path: str | None = Field(None, description="Display path shown in preview")
    seo_title: str | None = Field(None, description="SEO Title")
    meta_description: str | None = Field(None, description="Meta Description")
    headlines: list[str] = Field(default_factory=list, description="Google Ads style headlines")
    descriptions: list[str] = Field(default_factory=list, description="Google Ads style descriptions")
    keywords: list[str] = Field(default_factory=list, description="SEO target keywords")
    body_content: str | None = Field(None, description="Body content of the page")
    user_persona: str | None = Field(None, description="Target audience persona")


class SeoContentUpdate(CamelModel):
    project_name: str | None = None
    final_url: str | None = None
    display_path: str | None = None
    seo_title: str | None = None
    meta_description: str | None = None
    headlines: list[str] | None = None
    descriptions: list[str] | None = None
    keywords: list[str] | None = None
    body_content: str | None = None
    user_persona: str | None = None


class SeoContentResponse(CamelModel):
    id: str
    user_id: str
    project_name: str | None = None
    final_url: str | None = None
    display_path: str | None = None
    seo_title: str | None = None
    meta_description: str | None = None
    headlines: list[str] = []
    descriptions: list[str] = []
    keywords: list[str] = []
    body_content: str | None = None
    user_persona: str | None = None
    seo_score: int
    created_at: datetime
    updated_at: datetime


class SeoContentListResponse(CamelModel):
    total: int
    items: list[SeoContentResponse] = []


class SeoScoreRequest(CamelModel):
    seo_title: str | None = None
    meta_description: str | None = None
    headlines: list[str] = []
    descriptions: list[str] = []
    keywords: list[str] = []
    body_content: str | None = None


class KeywordScoreBreakdown(CamelModel):
    keyword: str
    found_in_title: bool
    found_in_description: bool
    found_in_headlines: bool
    found_in_body: bool
    body_density: float


class SeoScoreResponse(CamelModel):
    score: int
    warnings: list[str] = []
    keyword_breakdown: list[KeywordScoreBreakdown] = []


class SeoResearchRequest(CamelModel):
    project_name: str = Field(..., description="Tên dự án affiliate")
    affiliate_url: str = Field(..., description="Link trang chủ hoặc landing page affiliate")


class SeoResearchResponse(CamelModel):
    keywords: list[str] = []
    seo_title: str = ""
    meta_description: str = ""
    headlines: list[str] = []
    descriptions: list[str] = []
    display_path: str = ""
    body_content: str = ""
    user_persona: str = ""
