# app/shared/agents/ads_search_agent/edges.py

from server.app.shared.agents.search_ads.state import AdsSearchState


def route_after_search(state: AdsSearchState) -> str:
    if state.get("errors"):
        last_error = state["errors"][-1].lower()

        if "captcha" in last_error:
            return "error"

        if "timeout" in last_error:
            return "error"

    if not state.get("serp_html"):
        return "error"

    return "continue"


def route_after_parse_serp(state: AdsSearchState) -> str:
    if state.get("errors"):
        return "error"

    ad_candidates = state.get("ad_candidates", [])

    if len(ad_candidates) == 0:
        return "no_ads"

    return "has_ads"
