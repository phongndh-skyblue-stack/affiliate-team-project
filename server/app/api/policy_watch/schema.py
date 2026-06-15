from __future__ import annotations

from datetime import datetime

from app.shared.responses import CamelModel


class PolicyChangeEventResponse(CamelModel):
    id: str
    source_url: str
    platform: str = "Google Ads"
    title: str | None = None
    summary: str | None = None
    diff_excerpt: str | None = None
    detected_at: datetime


class PolicyChangeListResponse(CamelModel):
    total: int
    items: list[PolicyChangeEventResponse] = []


class PolicySnapshotStatus(CamelModel):
    source_url: str
    platform: str = "Google Ads"
    title: str | None = None
    fetched_at: datetime
    changed_at: datetime | None = None


class PolicyWatchStatusResponse(CamelModel):
    sources: list[PolicySnapshotStatus] = []


class PolicyCheckResult(CamelModel):
    checked: int
    changed: int
    new_sources: int
    errors: list[str] = []
