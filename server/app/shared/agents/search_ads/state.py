# app/shared/agents/ads_search_agent/state.py

from typing import TypedDict, Optional, Literal


class ProxyConfig(TypedDict, total=False):
    enabled: bool
    country: Optional[str]
    server: Optional[str]
    username: Optional[str]
    password: Optional[str]


class SearchAdItem(TypedDict, total=False):
    position: int
    title: str
    snippet: str
    display_url: str
    target_url: str
    is_ad: bool
    ad_label: Optional[str]

    advertiser_name: Optional[str]
    advertiser_domain: Optional[str]
    advertiser_location: Optional[str]
    ad_info_raw: Optional[dict]

    confidence: float
    source: str
    landing_page: Optional[dict]


class AdsSearchState(TypedDict):
    keyword: str
    location: str
    language: str
    device: Literal["desktop", "mobile"]

    proxy: ProxyConfig
    record_video_dir: Optional[str]

    search_url: Optional[str]
    serp_html: Optional[str]
    serp_screenshot_path: Optional[str]

    organic_links: list[dict]
    ad_candidates: list[SearchAdItem]
    confirmed_ads: list[SearchAdItem]

    current_ad_index: int

    final_results: list[SearchAdItem]
    final_summary: str

    errors: list[str]
    status: Literal[
        "init",
        "searching",
        "parsing_serp",
        "extracting_ad_info",
        "crawling_landing_pages",
        "summarizing",
        "done",
        "failed",
    ]
