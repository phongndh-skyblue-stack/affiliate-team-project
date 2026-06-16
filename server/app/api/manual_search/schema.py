from __future__ import annotations

from pydantic import Field, model_validator

from app.shared.responses import CamelModel

LOCATION_GL_MAP = {
    "Vietnam": "vn",
    "United States": "us",
    "United Kingdom": "uk",
    "Australia": "au",
    "Canada": "ca",
    "Singapore": "sg",
    "Thailand": "th",
    "Malaysia": "my",
    "Indonesia": "id",
    "Philippines": "ph",
    "India": "in",
    "Japan": "jp",
    "South Korea": "kr",
    "China": "cn",
    "Taiwan": "tw",
    "Hong Kong": "hk",
    "Germany": "de",
    "France": "fr",
    "Spain": "es",
    "Italy": "it",
    "Netherlands": "nl",
    "Belgium": "be",
    "Switzerland": "ch",
    "Sweden": "se",
    "Norway": "no",
    "Denmark": "dk",
    "Finland": "fi",
    "Poland": "pl",
    "Brazil": "br",
    "Mexico": "mx",
    "United Arab Emirates": "ae",
    "Saudi Arabia": "sa",
    "Turkey": "tr",
    "South Africa": "za",
    "New Zealand": "nz",
}


class CompetitorSearchRequest(CamelModel):
    keyword: str = Field(..., description="Từ khóa cần tìm đối thủ")
    location: str = Field("Vietnam", description="Vị trí địa lý")
    hl: str = Field("vi", description="Ngôn ngữ giao diện (vi, en...)")
    gl: str = Field("vn", description="Mã quốc gia (vn, us...)")
    num: int = Field(10, ge=1, le=100, description="Số kết quả organic")
    no_cache: bool = Field(False, description="Bỏ qua cache SerpAPI")
    project_id: str | None = Field(None, description="Project ID when searching from a saved project")

    enrich_advertisers: bool = Field(
        True,
        description="Look up advertiser candidates from Google Ads Transparency",
    )

    @model_validator(mode="after")
    def sync_location_and_country_code(self) -> "CompetitorSearchRequest":
        expected_gl = LOCATION_GL_MAP.get(self.location)
        if expected_gl:
            self.gl = expected_gl
        return self

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


class CompetitorSitelinkItem(CamelModel):
    title: str = ""
    link: str = ""
    tracking_link: str = ""
    snippet: str = ""


class AdvertiserCandidate(CamelModel):
    advertiser_id: str = ""
    paid_for_by: str = ""
    creative_id: str = ""
    format: str = ""
    target_domain: str = ""
    first_shown: int | None = None
    last_shown: int | None = None
    total_days_shown: int | None = None
    details_link: str = ""
    advertiser_ads_link: str = ""
    display_region: str = ""


class CompetitorAdItem(CamelModel):
    position: str
    advertiser: str
    title: str
    snippet: str
    link: str
    sitelinks: list[str]
    type: str
    displayed_link: str = ""
    tracking_link: str = ""
    source: str = ""
    destination_domain: str = ""
    destination_path: str = ""
    ref_parameters: dict[str, str] = Field(default_factory=dict)
    sitelink_items: list[CompetitorSitelinkItem] = Field(default_factory=list)
    advertiser_candidates: list[AdvertiserCandidate] = Field(default_factory=list)
    advertiser_lookup_status: str = "not_requested"


class CompetitorSearchResponse(CamelModel):
    project_id: str | None = None
    project_name: str | None = None
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
    project_id: str | None = None
    project_name: str | None = None
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
