from __future__ import annotations

import math
import re
from typing import Any


_INTENT_MODIFIERS: tuple[tuple[str, frozenset[str]], ...] = (
    ("navigational", frozenset({"login", "signin", "website", "official", "app"})),
    ("transactional", frozenset({"buy", "price", "pricing", "discount", "coupon", "deal", "order", "trial"})),
    ("commercial", frozenset({"best", "review", "reviews", "compare", "comparison", "alternative", "vs"})),
    ("informational", frozenset({"how", "what", "why", "when", "where", "guide", "tutorial", "tips"})),
)


def classify_intent(keyword: str) -> str:
    tokens = set(re.findall(r"[\w]+", keyword.casefold()))
    for intent, modifiers in _INTENT_MODIFIERS:
        if tokens & modifiers:
            return intent
    return "unknown"


def calculate_trend(monthly_searches: list[dict[str, Any]]) -> float:
    values = [float(item.get("searches") or 0) for item in monthly_searches]
    nonzero = [value for value in values if value > 0]
    if len(nonzero) < 2:
        return 0.0
    return max(-1.0, min(1.0, (nonzero[-1] - nonzero[0]) / nonzero[0]))


def _normalize(values: list[float]) -> list[float]:
    if not values:
        return []
    low, high = min(values), max(values)
    if math.isclose(low, high):
        return [0.5 for _ in values]
    return [(value - low) / (high - low) for value in values]


def enrich_keyword_ideas(ideas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not ideas:
        return []

    volumes = _normalize([math.log1p(max(0, int(item.get("avg_monthly_searches") or 0))) for item in ideas])
    present_bids = [
        float(item.get("high_top_page_bid"))
        for item in ideas
        if item.get("high_top_page_bid") is not None
    ]
    normalized_present_bids = _normalize(present_bids)
    bid_cursor = iter(normalized_present_bids)
    bids = [next(bid_cursor) if item.get("high_top_page_bid") is not None else 0.5 for item in ideas]

    enriched: list[dict[str, Any]] = []
    for index, item in enumerate(ideas):
        competition_index = item.get("competition_index")
        inverse_competition = 0.5 if competition_index is None else 1 - max(0, min(100, int(competition_index))) / 100
        raw_trend = calculate_trend(item.get("monthly_searches") or [])
        positive_trend = (raw_trend + 1) / 2
        score = round(
            volumes[index] * 45
            + inverse_competition * 25
            + bids[index] * 20
            + positive_trend * 10
        )
        score = max(0, min(100, score))
        tier = "high" if score >= 75 else "medium" if score >= 45 else "low"
        copy = dict(item)
        copy.update(
            {
                "intent": classify_intent(str(item.get("keyword") or "")),
                "opportunity_score": score,
                "opportunity_tier": tier,
                "trend_percentage": round(raw_trend * 100, 1),
                "score_explanation": (
                    f"Nhu cầu {round(volumes[index] * 45)}/45 · "
                    f"Cạnh tranh {round(inverse_competition * 25)}/25 · "
                    f"Giá thầu {round(bids[index] * 20)}/20 · "
                    f"Xu hướng {round(positive_trend * 10)}/10"
                ),
            }
        )
        enriched.append(copy)
    return enriched
