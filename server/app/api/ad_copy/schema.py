from __future__ import annotations

from pydantic import Field, field_validator

from app.shared.responses import CamelModel


class AdCopyGenerateRequest(CamelModel):
    landing_page_url: str = Field(..., min_length=1, max_length=300)
    keyword: str = Field(..., min_length=1, max_length=80)
    language: str = Field("vi", pattern="^(vi|en)$")

    @field_validator("landing_page_url", "keyword")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class SitelinkItem(CamelModel):
    text: str
    description_1: str
    description_2: str
    final_url: str | None = None


class AdCopyGenerateResponse(CamelModel):
    landing_page_title: str | None = None
    landing_page_summary: str
    keyword_headlines: list[str]
    headlines: list[str]
    descriptions: list[str]
    sitelinks: list[SitelinkItem]
    callouts: list[str]
    structured_snippets: list[str]
    words_to_avoid: list[str]
    safer_content_directions: list[str]
    sensitive_content_note: str
