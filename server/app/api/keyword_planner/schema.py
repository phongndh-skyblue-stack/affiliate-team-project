from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import EmailStr, Field, field_validator
from urllib.parse import urlsplit

from app.shared.responses import CamelModel


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------


class ScanByKeywordsRequest(CamelModel):
    ads_id: str = Field(..., description="Google Ads customer ID (imported account)")
    keywords: list[str] = Field(..., min_length=1, description="Seed keywords")
    page_url: Optional[str] = Field(None, description="Optional URL to combine with keywords")
    language_id: int = Field(1000, description="Language criterion ID (1000=English, 1019=Vietnamese)")
    location_ids: list[int] = Field(default_factory=list, description="Geo-target IDs (empty = all)")
    result_limit: int = Field(500, ge=1, le=2000, description="Max keyword ideas to return")
    project_id: Optional[str] = Field(None, description="Project ID used by project aggregation")

    @field_validator("page_url")
    @classmethod
    def normalize_optional_url(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_web_url(value) if value else None

    @field_validator("keywords")
    @classmethod
    def strip_and_deduplicate(cls, v: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for kw in v:
            kw = kw.strip()
            if kw and kw not in seen:
                seen.add(kw)
                result.append(kw)
        if not result:
            raise ValueError("keywords list must not be empty after stripping")
        return result


class ScanByUrlRequest(CamelModel):
    ads_id: str = Field(..., description="Google Ads customer ID (imported account)")
    page_url: str = Field(..., description="URL of the page or site to scan")
    use_entire_site: bool = Field(True, description="True = scan entire domain (SiteSeed); False = single page (UrlSeed)")
    language_id: int = Field(1000, description="Language criterion ID")
    location_ids: list[int] = Field(default_factory=list, description="Geo-target IDs (empty = all)")
    result_limit: int = Field(500, ge=1, le=2000, description="Max keyword ideas to return")
    project_id: Optional[str] = Field(None, description="Project ID used by project aggregation")

    @field_validator("page_url")
    @classmethod
    def normalize_page_url(cls, value: str) -> str:
        return _normalize_web_url(value)


def _normalize_web_url(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("URL must not be empty")
    if "://" not in normalized:
        normalized = f"https://{normalized}"
    parsed = urlsplit(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a valid domain or full http(s) URL")
    return normalized


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


class MonthlySearchVolumeItem(CamelModel):
    year: int
    month: int
    searches: int


class KeywordIdeaItem(CamelModel):
    id: str
    keyword: str
    avg_monthly_searches: int
    competition: str
    competition_index: Optional[int]
    low_top_page_bid: Optional[float]
    high_top_page_bid: Optional[float]
    monthly_searches: list[MonthlySearchVolumeItem]
    intent: Optional[str] = None
    opportunity_score: Optional[int] = None
    opportunity_tier: Optional[str] = None
    trend_percentage: Optional[float] = None
    score_explanation: Optional[str] = None


class JobResponse(CamelModel):
    id: str
    ads_id: Optional[str]
    input_type: str
    keywords: Optional[list[str]]
    page_url: Optional[str]
    use_entire_site: bool
    language_id: int
    location_ids: Optional[list[int]]
    result_limit: int
    status: str
    error_message: Optional[str]
    result_count: int
    project_id: Optional[str]
    project_name: Optional[str]
    created_at: str
    updated_at: str


class JobResultsResponse(CamelModel):
    job: JobResponse
    results: list[KeywordIdeaItem]


class JobListResponse(CamelModel):
    items: list[JobResponse]
    total: int


# ===========================================================================
# Mail Delegation Schemas
# ===========================================================================


# --- Requests ---

class AddMailRequest(CamelModel):
    email: EmailStr = Field(..., description="Gmail address to add for delegation")


class DelegationCallbackRequest(CamelModel):
    code: str = Field(..., description="Authorization code from Google")
    state: str = Field(..., description="State token to match against stored PKCE state")


class ImportAccountsRequest(CamelModel):
    ads_ids: list[str] = Field(..., min_length=1, description="Google Ads Customer IDs to import")


# --- Responses ---

class MailResponse(CamelModel):
    id: str
    email: str
    user_id: str
    created_at: datetime
    is_delegated: bool = False
    expires_in: Optional[datetime] = None
    accounts: list["AdsAccountResponse"] = Field(default_factory=list)


class MailListResponse(CamelModel):
    total: int
    items: list[MailResponse]


class SendAuthResponse(CamelModel):
    message: str
    expires_at: datetime
    auth_url: Optional[str] = None


class AccountNode(CamelModel):
    ads_id: str
    ads_name: str
    ads_status: Optional[str] = None
    currency_code: Optional[str] = None
    timezone: Optional[str] = None
    is_manager: bool = False
    manager_account_ads_id: str = ""
    is_already_in_database: bool = False
    sub_accounts: list["AccountNode"] = Field(default_factory=list)


AccountNode.model_rebuild()


class CallbackResponse(CamelModel):
    message: str
    mail_id: str
    accounts: list[AccountNode] = Field(default_factory=list)
    unaccessible_ids: list[str] = Field(default_factory=list)


class AdsAccountResponse(CamelModel):
    id: str
    mail_id: str
    ads_id: str
    ads_name: str
    ads_status: Optional[str] = None
    account_type: Optional[str] = None
    manager_account_ads_id: Optional[str] = None
    currency_code: Optional[str] = None
    timezone: Optional[str] = None
    budget_paid: Optional[float] = None
    budget_used: Optional[float] = None
    budget_adjustment: Optional[float] = None
    created_at: datetime


class AdsAccountListResponse(CamelModel):
    total: int
    items: list[AdsAccountResponse]


# ===========================================================================
# Candidate project schemas
# ===========================================================================

CandidateStatus = Literal["new", "researching", "promising", "rejected", "promoted"]
KeywordIntent = Literal["informational", "commercial", "transactional", "navigational", "unknown"]
OpportunityTier = Literal["high", "medium", "low"]


def _clean_tags(values: list[str]) -> list[str]:
    seen: set[str] = set()
    cleaned: list[str] = []
    for value in values[:20]:
        tag = value.strip()
        key = tag.casefold()
        if tag and key not in seen:
            seen.add(key)
            cleaned.append(tag)
    return cleaned


class CandidateKeywordInput(CamelModel):
    source_result_id: Optional[str] = None
    keyword: str = Field(..., min_length=1, max_length=500)
    avg_monthly_searches: int = Field(0, ge=0)
    competition: str = ""
    competition_index: Optional[int] = Field(None, ge=0, le=100)
    low_top_page_bid: Optional[float] = Field(None, ge=0)
    high_top_page_bid: Optional[float] = Field(None, ge=0)
    monthly_searches: list[MonthlySearchVolumeItem] = Field(default_factory=list)
    inferred_intent: KeywordIntent = "unknown"
    manual_intent: Optional[KeywordIntent] = None
    opportunity_score: int = Field(0, ge=0, le=100)
    opportunity_tier: OpportunityTier = "low"
    score_explanation: str = ""
    notes: Optional[str] = None
    tags: list[str] = Field(default_factory=list)

    @field_validator("keyword")
    @classmethod
    def clean_keyword(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Keyword is required")
        return cleaned

    @field_validator("tags")
    @classmethod
    def clean_keyword_tags(cls, value: list[str]) -> list[str]:
        return _clean_tags(value)


class CandidateCreateRequest(CamelModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: CandidateStatus = "new"
    notes: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    language_id: int = 1000
    location_ids: list[int] = Field(default_factory=list)
    source_ads_id: Optional[str] = None
    source_job_id: Optional[str] = None
    website_url: Optional[str] = None
    keywords: list[CandidateKeywordInput] = Field(..., min_length=1, max_length=500)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Candidate name is required")
        return cleaned

    @field_validator("tags")
    @classmethod
    def clean_candidate_tags(cls, value: list[str]) -> list[str]:
        return _clean_tags(value)

    @field_validator("website_url")
    @classmethod
    def normalize_candidate_url(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_web_url(value) if value else None


class CandidateUpdateRequest(CamelModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[CandidateStatus] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    language_id: Optional[int] = None
    location_ids: Optional[list[int]] = None
    website_url: Optional[str] = None
    keywords: Optional[list[CandidateKeywordInput]] = Field(None, min_length=1, max_length=500)

    @field_validator("name")
    @classmethod
    def clean_optional_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Candidate name is required")
        return cleaned

    @field_validator("tags")
    @classmethod
    def clean_optional_tags(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        return _clean_tags(value) if value is not None else None

    @field_validator("website_url")
    @classmethod
    def normalize_optional_candidate_url(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_web_url(value) if value else None


class CandidatePromoteRequest(CamelModel):
    website_url: Optional[str] = None

    @field_validator("website_url")
    @classmethod
    def normalize_promotion_url(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_web_url(value) if value else None


class CandidateKeywordResponse(CandidateKeywordInput):
    id: str
    effective_intent: KeywordIntent
    created_at: datetime
    updated_at: datetime


class CandidateResponse(CamelModel):
    id: str
    user_id: str
    affiliate_project_id: Optional[str]
    source_job_id: Optional[str]
    source_ads_id: Optional[str]
    name: str
    description: Optional[str]
    status: CandidateStatus
    notes: Optional[str]
    tags: list[str]
    language_id: int
    location_ids: list[int]
    website_url: Optional[str]
    keywords: list[CandidateKeywordResponse]
    created_at: datetime
    updated_at: datetime


class CandidateListResponse(CamelModel):
    total: int
    items: list[CandidateResponse]


class ImportAccountsResponse(CamelModel):
    message: str
    imported: int
    accounts: list[AdsAccountResponse]
