from __future__ import annotations

from pydantic import Field

from app.shared.responses import CamelModel


class CaptionGenerateRequest(CamelModel):
    platform: str = Field(..., description="facebook | instagram | tiktok | linkedin | threads | x")
    goal: str = Field("sales", description="sales | education | community | engagement | announcement")
    idea: str = Field(..., description="Ý tưởng/chủ đề/sản phẩm cần viết caption")
    segment: str | None = Field(None, description="Đối tượng/persona (pain point, mong muốn)")
    brand_name: str | None = Field(None, description="Tên thương hiệu")
    language: str = Field("auto", description="auto | vi | en")
    tone: str | None = Field(None, description="Tone mong muốn (vd: thân thiện, chuyên nghiệp)")
    affiliate_url: str | None = Field(None, description="Link CTA — sẽ được bảo toàn nguyên vẹn")
    variants: int = Field(1, ge=1, le=3, description="Số biến thể caption (A/B test)")
    # Giai đoạn 2 — nối ống dữ liệu
    keywords: list[str] = Field(default_factory=list, description="Keyword SEO (từ Research AI) làm hạt giống hashtag/angle")
    competitor_angles: list[str] = Field(default_factory=list, description="Tiêu đề/góc quảng cáo đối thủ (từ Quét quảng cáo) để tạo khác biệt")


class CaptionVariant(CamelModel):
    platform: str
    goal: str
    language: str
    segment: str | None = None
    content: str
    hashtags: list[str] = []
    char_count: int
    char_limit: int
    hook_cutoff: int
    within_limit: bool
    within_hook_cutoff: bool
    hook_on_screen: str | None = None  # chỉ TikTok
    visual_suggestion: str | None = None
    cta_link: str | None = None


class CaptionGenerateResponse(CamelModel):
    captions: list[CaptionVariant] = []
    detected_industries: list[str] = []
    compliance_notes: list[str] = []
    placeholders: list[str] = []
