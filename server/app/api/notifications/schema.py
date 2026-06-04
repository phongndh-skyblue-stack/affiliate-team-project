from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import Field

from app.shared.responses import CamelModel


class NotificationResponse(CamelModel):
    id: str
    user_id: str
    type: str
    payload: dict[str, Any]
    is_read: bool
    created_at: datetime


class NotificationListResponse(CamelModel):
    total: int
    unread_count: int
    items: list[NotificationResponse]
