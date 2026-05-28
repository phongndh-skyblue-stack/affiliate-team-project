from __future__ import annotations

from pydantic import Field

from app.shared.responses import CamelModel


class CompetitorSearchRequest(CamelModel):
    keyword: str = Field(..., description="Từ khóa cần tìm đối thủ")
    location: str = Field("Vietnam", description="Vị trí địa lý")
    hl: str = Field("vi", description="Ngôn ngữ giao diện (vi, en...)")
    gl: str = Field("vn", description="Mã quốc gia (vn, us...)")
    num: int = Field(10, ge=1, le=100, description="Số kết quả organic")
    no_cache: bool = Field(False, description="Bỏ qua cache SerpAPI")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "keyword": "mua laptop gaming",
                    "location": "Vietnam",
                    "hl": "vi",
                    "gl": "vn",
                    "num": 10,
                    "no_cache": False,
                }
            ]
        }
    }


class CompetitorAdItem(CamelModel):
    position: str
    advertiser: str
    title: str
    snippet: str
    link: str
    sitelinks: list[str]
    type: str


class CompetitorSearchResponse(CamelModel):
    keyword: str
    google_url: str
    total_ads_found: int
    top_ads_count: int
    bottom_ads_count: int
    ads: list[CompetitorAdItem]


class CompetitorSearchHistoryItem(CamelModel):
    id: str
    user_id: str | None
    keyword: str
    google_url: str
    location: str
    hl: str
    gl: str
    num: int
    no_cache: bool
    total_ads_found: int
    top_ads_count: int
    bottom_ads_count: int
    ads: list[CompetitorAdItem]
    raw_data: dict | None = None
    created_at: str
    updated_at: str


class CompetitorSearchHistoryResponse(CamelModel):
    total: int
    items: list[CompetitorSearchHistoryItem]
