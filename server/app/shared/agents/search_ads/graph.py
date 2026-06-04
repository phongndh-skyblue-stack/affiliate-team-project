# app/shared/agents/ads_search_agent/graph.py

from langgraph.graph import StateGraph, END

from app.shared.agents.search_ads.state import AdsSearchState
from app.shared.agents.search_ads.nodes import (
    validate_input_node,
    prepare_browser_node,
    search_and_extract_node,
    crawl_landing_pages_node,
    classify_and_normalize_node,
    summarize_results_node,
    summarize_no_ads_node,
    handle_error_node,
)


def build_ads_search_graph():
    graph = StateGraph(AdsSearchState)

    graph.add_node("validate_input", validate_input_node)
    graph.add_node("prepare_browser", prepare_browser_node)
    graph.add_node("search_and_extract", search_and_extract_node)
    graph.add_node("crawl_landing_pages", crawl_landing_pages_node)
    graph.add_node("classify_and_normalize", classify_and_normalize_node)
    graph.add_node("summarize_results", summarize_results_node)
    graph.add_node("summarize_no_ads", summarize_no_ads_node)
    graph.add_node("handle_error", handle_error_node)

    graph.set_entry_point("validate_input")

    graph.add_edge("validate_input", "prepare_browser")
    graph.add_edge("prepare_browser", "search_and_extract")

    graph.add_conditional_edges(
        "search_and_extract",
        lambda s: (
            "error" if s.get("status") == "failed"
            else "no_ads" if s.get("status") == "no_ads"
            else "continue"
        ),
        {
            "continue": "crawl_landing_pages",
            "no_ads": "summarize_no_ads",
            "error": "handle_error",
        },
    )

    graph.add_edge("crawl_landing_pages", "classify_and_normalize")
    graph.add_edge("classify_and_normalize", "summarize_results")

    graph.add_edge("summarize_results", END)
    graph.add_edge("summarize_no_ads", END)
    graph.add_edge("handle_error", END)

    return graph.compile()