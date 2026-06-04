from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.telegram.schema import (
    TelegramConfigResponse,
    TelegramScheduleNotificationSettings,
    TelegramSubscriptionResponse,
    TelegramVerificationCodeResponse,
)
from app.api.telegram.service import TelegramService, to_subscription_response
from app.api.telegram.verification import generate_verification_code, get_verification_ttl_seconds
from app.core.database import get_db
from app.shared.deps import get_current_user

router = APIRouter(prefix="/telegram", tags=["Telegram"])


def get_service(db: Session = Depends(get_db)) -> TelegramService:
    return TelegramService(db)


@router.get("/config", response_model=TelegramConfigResponse)
def get_telegram_config(service: TelegramService = Depends(get_service)) -> TelegramConfigResponse:
    return TelegramConfigResponse(**service.get_config())


@router.get("/subscription", response_model=TelegramSubscriptionResponse | None)
def get_telegram_subscription(
    current_user: User = Depends(get_current_user),
    service: TelegramService = Depends(get_service),
) -> TelegramSubscriptionResponse | None:
    subscription = service.get_subscription(current_user.id)
    return to_subscription_response(subscription) if subscription else None


@router.post("/generate-verification-code", response_model=TelegramVerificationCodeResponse)
async def generate_telegram_verification_code(
    current_user: User = Depends(get_current_user),
    service: TelegramService = Depends(get_service),
) -> TelegramVerificationCodeResponse:
    config = service.get_config()
    if not config["enabled"]:
        raise HTTPException(status_code=503, detail="Telegram bot is not configured")

    ttl_seconds = get_verification_ttl_seconds()
    code = await generate_verification_code(current_user.id, ttl_seconds)
    command = f"/verify {code}"
    expires_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)
    return TelegramVerificationCodeResponse(
        code=code,
        command=command,
        instruction=f"Chat voi @{config['bot_username']} va gui: {command}",
        expires_in_minutes=max(1, ttl_seconds // 60),
        expires_at=expires_at.isoformat().replace("+00:00", "Z"),
    )


@router.delete("/subscription", status_code=204, response_model=None)
def unlink_telegram_account(
    current_user: User = Depends(get_current_user),
    service: TelegramService = Depends(get_service),
) -> None:
    service.unlink(current_user.id)


@router.put("/subscription/schedule-notifications", response_model=TelegramSubscriptionResponse)
def update_schedule_notifications(
    payload: TelegramScheduleNotificationSettings,
    current_user: User = Depends(get_current_user),
    service: TelegramService = Depends(get_service),
) -> TelegramSubscriptionResponse:
    subscription = service.set_scheduled_search_notifications(current_user.id, payload.enabled)
    return to_subscription_response(subscription)
