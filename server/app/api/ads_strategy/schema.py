from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.shared.responses import CamelModel


class AdsStrategyRequest(CamelModel):
    affiliate_link_id: str = Field(..., min_length=1)
    budget: float = Field(500.0, ge=0)
    duration_days: int = Field(7, ge=1, le=90)
    currency: str = Field("USD", min_length=3, max_length=3)


class StrategyKeyword(CamelModel):
    keyword: str
    source: str
    intent: str
    match_type: Literal["Exact", "Phrase", "Broad"]
    avg_monthly_searches: int | None = None
    competition: str | None = None
    low_top_page_bid: float | None = None
    high_top_page_bid: float | None = None
    last_3_month_searches: list[int] = Field(default_factory=list)
    note: str


class CustomerSegment(CamelModel):
    name: str
    demographics: str
    pain_points: list[str] = Field(default_factory=list)
    needs: list[str] = Field(default_factory=list)
    messaging_angle: str


class AdGroupPlan(CamelModel):
    name: str
    objective: str
    keywords: list[StrategyKeyword] = Field(default_factory=list)
    rationale: str


class Sitelink(CamelModel):
    title: str
    description_1: str
    description_2: str
    url: str


class RsaCopy(CamelModel):
    headlines: list[str] = Field(default_factory=list)
    descriptions: list[str] = Field(default_factory=list)
    callouts: list[str] = Field(default_factory=list)
    sitelinks: list[Sitelink] = Field(default_factory=list)


class BudgetAllocation(CamelModel):
    label: str
    percent: int
    amount: float
    rationale: str


class BudgetPlan(CamelModel):
    total_budget: float
    duration_days: int
    daily_budget: float
    currency: str
    recommendation: str
    allocations: list[BudgetAllocation] = Field(default_factory=list)


class PolicyWarning(CamelModel):
    level: Literal["info", "warning", "critical"]
    title: str
    detail: str


class AdsStrategyResponse(CamelModel):
    affiliate_link_id: str
    website: str
    domain: str
    generated_at: str
    product_summary: str
    market_stage: str
    geo_recommendation: str
    data_confidence: Literal["low", "medium", "high"]
    data_notes: list[str] = Field(default_factory=list)
    policy_warnings: list[PolicyWarning] = Field(default_factory=list)
    keyword_table: list[StrategyKeyword] = Field(default_factory=list)
    customer_segments: list[CustomerSegment] = Field(default_factory=list)
    ad_groups: list[AdGroupPlan] = Field(default_factory=list)
    rsa: RsaCopy
    budget_plan: BudgetPlan
