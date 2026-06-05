from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.telegram.schema import (
    TelegramConfigResponse,
    TelegramScheduleNotificationSettings,
    TelegramSubscriptionResponse,
    TelegramVerificationCodeResponse,
)
from app.api.notifications.service import NotificationService
from app.api.telegram.notifications import send_telegram_message
from app.api.telegram.service import TelegramService, to_subscription_response
from app.api.telegram.verification import generate_verification_code, get_verification_ttl_seconds
from app.core.config import settings
from app.core.database import get_db
from app.shared.deps import get_current_user
from app.shared.ws_manager import emit_to_user

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
async def unlink_telegram_account(
    current_user: User = Depends(get_current_user),
    service: TelegramService = Depends(get_service),
    db: Session = Depends(get_db),
) -> None:
    chat_id = service.unlink(current_user.id)
    payload = {
        "message": "Đã hủy liên kết Telegram bot",
        "description": "Tài khoản của bạn đã hủy liên kết với bot Telegram.",
        "chatId": chat_id,
    }
    notification = NotificationService(db).create(
        user_id=current_user.id,
        type="telegram_unlinked",
        payload=payload,
    )
    await emit_to_user(current_user.id, "telegram_unlinked", {"userId": current_user.id})
    await emit_to_user(
        current_user.id,
        "telegram_notification",
        {
            **payload,
            "id": notification.id,
            "type": notification.type,
            "createdAt": notification.created_at.isoformat(),
        },
    )
    if chat_id:
        try:
            await send_telegram_message(chat_id, "Bạn đã huỷ liên kết Telegram bot với tài khoản MIC ACE.")
        except Exception:
            pass


@router.put("/subscription/schedule-notifications", response_model=TelegramSubscriptionResponse)
def update_schedule_notifications(
    payload: TelegramScheduleNotificationSettings,
    current_user: User = Depends(get_current_user),
    service: TelegramService = Depends(get_service),
) -> TelegramSubscriptionResponse:
    subscription = service.set_scheduled_search_notifications(current_user.id, payload.enabled)
    return to_subscription_response(subscription)


@router.post("/internal/verified", include_in_schema=False)
async def notify_telegram_verified(
    payload: dict,
    x_telegram_bot_token: str | None = Header(None),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    if not settings.TELEGRAM_BOT_TOKEN or x_telegram_bot_token != settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden")

    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    notification_payload = {
        "message": "Liên kết Telegram thành công",
        "description": "Tài khoản của bạn đã liên kết với bot Telegram.",
        "chatId": payload.get("chat_id"),
    }
    notification = NotificationService(db).create(
        user_id=user_id,
        type="telegram_linked",
        payload=notification_payload,
    )

    await emit_to_user(
        user_id,
        "telegram_linked",
        {
            "userId": user_id,
            "chatId": payload.get("chat_id"),
        },
    )
    await emit_to_user(
        user_id,
        "telegram_notification",
        {
            **notification_payload,
            "id": notification.id,
            "type": notification.type,
            "createdAt": notification.created_at.isoformat(),
        },
    )
    return {"ok": True}


@router.post("/internal/unlinked", include_in_schema=False)
async def notify_telegram_unlinked(
    payload: dict,
    x_telegram_bot_token: str | None = Header(None),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    if not settings.TELEGRAM_BOT_TOKEN or x_telegram_bot_token != settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden")

    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    notification_payload = {
        "message": "Đã hủy liên kết Telegram bot",
        "description": "Tài khoản của bạn đã hủy liên kết với bot Telegram.",
    }
    notification = NotificationService(db).create(
        user_id=user_id,
        type="telegram_unlinked",
        payload=notification_payload,
    )

    await emit_to_user(user_id, "telegram_unlinked", {"userId": user_id})
    await emit_to_user(
        user_id,
        "telegram_notification",
        {
            **notification_payload,
            "id": notification.id,
            "type": notification.type,
            "createdAt": notification.created_at.isoformat(),
        },
    )
    return {"ok": True}
