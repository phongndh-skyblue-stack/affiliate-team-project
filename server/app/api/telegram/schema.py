from __future__ import annotations

from pydantic import Field

from app.shared.responses import CamelModel


class TelegramConfigResponse(CamelModel):
    bot_username: str
    enabled: bool


class TelegramVerificationCodeResponse(CamelModel):
    code: str
    command: str
    instruction: str
    expires_in_minutes: int
    expires_at: str


class TelegramSubscriptionResponse(CamelModel):
    id: str
    chat_id: int
    topics: list[str] = Field(default_factory=list)
    scheduled_search_notifications_enabled: bool
    enabled: bool
    created_at: str
    updated_at: str


class TelegramScheduleNotificationSettings(CamelModel):
    enabled: bool
