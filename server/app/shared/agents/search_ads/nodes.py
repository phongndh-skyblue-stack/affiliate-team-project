# app/shared/agents/ads_search_agent/nodes.py


from app.shared.agents.search_ads.services.google_search import GoogleSearchService
from app.shared.agents.search_ads.services.landing_page import LandingPageService
from app.shared.agents.search_ads.services.proxy import ProxyService
from app.shared.agents.search_ads.state import AdsSearchState


async def validate_input_node(state: AdsSearchState):
    keyword = state.get("keyword", "").strip()

    if not keyword:
        return {
            "status": "failed",
            "errors": ["Keyword is required"],
        }

    return {
        "keyword": keyword,
        "location": state.get("location") or "Vietnam",
        "language": state.get("language") or "vi",
        "device": state.get("device") or "desktop",
        "status": "init",
        "errors": state.get("errors", []),
    }

# Node này chuẩn bị browser context, proxy, stealth.
async def prepare_browser_node(state: AdsSearchState):
    proxy_service = ProxyService()

    proxy = await proxy_service.get_proxy_for_location(
        state.get("location", "Vietnam")
    )

    return {
        "proxy": proxy,
        "status": "searching",
    }


# Node GỘP: search + parse SERP + extract ad info trong MỘT browser session.
async def search_and_extract_node(state: AdsSearchState):
    try:
        service = GoogleSearchService()

        result = await service.search_and_extract_ads(
            keyword=state["keyword"],
            location=state["location"],
            language=state["language"],
            device=state["device"],
            proxy=state["proxy"],
            record_video_dir=state.get("record_video_dir"),
        )

        confirmed_ads = result["confirmed_ads"]

        return {
            "search_url": result["search_url"],
            "serp_html": result["html"],
            "serp_screenshot_path": result.get("screenshot_path"),
            "organic_links": result["organic_links"],
            "ad_candidates": confirmed_ads,
            "confirmed_ads": confirmed_ads,
            "status": "crawling_landing_pages" if confirmed_ads else "no_ads",
        }

    except Exception as e:
        return {
            "status": "failed",
            "errors": state.get("errors", []) + [f"Google search failed: {str(e)}"],
        }


# Node này thực hiện search và lưu lại HTML + screenshot.
async def search_google_node(state: AdsSearchState):
    try:
        service = GoogleSearchService()

        result = await service.search_first_page(
            keyword=state["keyword"],
            location=state["location"],
            language=state["language"],
            device=state["device"],
            proxy=state["proxy"],
            record_video_dir=state.get("record_video_dir"),
        )

        return {
            "search_url": result["search_url"],
            "serp_html": result["html"],
            "serp_screenshot_path": result.get("screenshot_path"),
            "status": "parsing_serp",
        }

    except Exception as e:
        return {
            "status": "failed",
            "errors": state.get("errors", []) + [f"Google search failed: {str(e)}"],
        }


# Node này quét page đầu tiên và tìm candidate quảng cáo.
async def parse_serp_node(state: AdsSearchState):
    try:
        service = GoogleSearchService()

        parsed = await service.parse_serp_html(
            html=state["serp_html"],
        )

        return {
            "organic_links": parsed["organic_links"],
            "ad_candidates": parsed["ad_candidates"],
            "status": "extracting_ad_info",
        }

    except Exception as e:
        return {
            "status": "failed",
            "errors": state.get("errors", []) + [f"Parse SERP failed: {str(e)}"],
        }


# Node này click dấu 3 chấm / ad info panel để lấy thêm thông tin.
async def extract_ad_info_node(state: AdsSearchState):
    try:
        service = GoogleSearchService()

        confirmed_ads = await service.extract_ad_info_from_candidates(
            keyword=state["keyword"],
            location=state["location"],
            language=state["language"],
            device=state["device"],
            proxy=state["proxy"],
            ad_candidates=state["ad_candidates"],
            record_video_dir=state.get("record_video_dir"),
        )

        return {
            "confirmed_ads": confirmed_ads,
            "status": "crawling_landing_pages",
        }

    except Exception as e:
        return {
            "confirmed_ads": state.get("ad_candidates", []),
            "errors": state.get("errors", []) + [f"Extract ad info failed: {str(e)}"],
            "status": "crawling_landing_pages",
        }


# Placeholder: crawl từng landing page của ad. Hiện tại bỏ qua, chỉ pass-through.
async def crawl_landing_pages_node(state: AdsSearchState):
    landing_page_service = LandingPageService()

    enriched_ads = []
    errors = state.get("errors", [])

    confirmed_ads = state.get("confirmed_ads", [])
    for index, ad in enumerate(confirmed_ads, start=1):
        original_url = ad.get("target_url")

        if not original_url:
            enriched_ads.append({
                **ad,
                "landing_page": {
                    "original_url": None,
                    "final_url": None,
                    "domain": None,
                    "redirect_chain": [],
                    "status": "skipped",
                    "error": "Missing target_url",
                },
            })
            continue

        try:
            landing_page_data = await landing_page_service.resolve_landing_url(
                url=original_url,
                proxy=state.get("proxy"),
            )

            enriched_ads.append({
                **ad,
                "landing_page": landing_page_data,
            })

        except Exception as e:
            errors.append(f"Resolve landing URL failed: {original_url} | {str(e)}")

            enriched_ads.append({
                **ad,
                "landing_page": {
                    "original_url": original_url,
                    "final_url": None,
                    "domain": None,
                    "redirect_chain": [],
                    "status": "failed",
                    "error": str(e),
                },
            })

    return {
        "confirmed_ads": enriched_ads,
        "errors": errors,
        "status": "landing_pages_resolved",
    }


# Node này chuẩn hóa dữ liệu trước khi trả về.
async def classify_and_normalize_node(state: AdsSearchState):
    results = []

    for index, ad in enumerate(state.get("confirmed_ads", []), start=1):
        results.append({
            "position": ad.get("position", index),
            "title": ad.get("title"),
            "snippet": ad.get("snippet"),
            "display_url": ad.get("display_url"),
            "target_url": ad.get("target_url"),
            "advertiser_name": ad.get("advertiser_name"),
            "advertiser_domain": ad.get("advertiser_domain"),
            "advertiser_location": ad.get("advertiser_location"),
            "confidence": ad.get("confidence", 0.7),
            "source": ad.get("source", "google_serp"),
            "landing_page": ad.get("landing_page"),
        })

    return {
        "final_results": results,
        "status": "summarizing",
    }


#Có thể dùng LLM hoặc không. Nếu chỉ trả JSON thì không cần LLM.
async def summarize_results_node(state: AdsSearchState):
    total = len(state.get("final_results", []))

    summary = f"Tìm thấy {total} quảng cáo liên quan đến từ khóa '{state['keyword']}'."

    return {
        "final_summary": summary,
        "status": "done",
    }



async def summarize_no_ads_node(state: AdsSearchState):
    return {
        "final_results": [],
        "final_summary": f"Không tìm thấy quảng cáo nào trên trang đầu Google cho từ khóa '{state['keyword']}'.",
        "status": "done",
    }


async def handle_error_node(state: AdsSearchState):
    errors = state.get("errors", [])

    return {
        "final_results": state.get("final_results", []),
        "final_summary": "Không thể hoàn tất quá trình tìm quảng cáo.",
        "errors": errors,
        "status": "failed",
    }
