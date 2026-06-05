from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.telegram.model import TelegramSubscription
from app.api.telegram.schema import TelegramSubscriptionResponse
from app.core.config import settings

SCHEDULED_SEARCH_TOPIC = "scheduled_search_ads_done"


class TelegramService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_config(self) -> dict[str, Any]:
        bot_username = _normalize_bot_username(settings.TELEGRAM_BOT_USERNAME)
        return {
            "bot_username": bot_username,
            "enabled": bool(settings.TELEGRAM_BOT_TOKEN and bot_username),
        }

    def get_subscription(self, user_id: str) -> TelegramSubscription | None:
        stmt = select(TelegramSubscription).where(TelegramSubscription.user_id == user_id)
        return self.db.scalar(stmt)

    def save_chat_link(self, user_id: str, chat_id: int) -> TelegramSubscription:
        subscription = self.get_subscription(user_id)
        if subscription is None:
            subscription = TelegramSubscription(
                user_id=user_id,
                chat_id=chat_id,
                topics=[],
                enabled=True,
            )
            self.db.add(subscription)

        subscription.chat_id = chat_id
        subscription.enabled = True

        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tai khoan Telegram nay da duoc lien ket voi user khac",
            ) from exc

        self.db.refresh(subscription)
        return subscription

    def set_scheduled_search_notifications(self, user_id: str, enabled: bool) -> TelegramSubscription:
        subscription = self.get_subscription(user_id)
        if subscription is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Telegram subscription not found")

        topics = set(subscription.topics or [])
        if enabled:
            topics.add(SCHEDULED_SEARCH_TOPIC)
        else:
            topics.discard(SCHEDULED_SEARCH_TOPIC)

        subscription.topics = sorted(topics)
        self.db.commit()
        self.db.refresh(subscription)
        return subscription

    def unlink(self, user_id: str) -> int | None:
        subscription = self.get_subscription(user_id)
        if subscription is None:
            return None
        chat_id = subscription.chat_id
        self.db.delete(subscription)
        self.db.commit()
        return chat_id

    def unlink_by_chat_id(self, chat_id: int) -> str | None:
        stmt = select(TelegramSubscription).where(TelegramSubscription.chat_id == chat_id)
        subscription = self.db.scalar(stmt)
        if subscription is None:
            return None

        user_id = subscription.user_id
        self.db.delete(subscription)
        self.db.commit()
        return user_id


def to_subscription_response(subscription: TelegramSubscription) -> TelegramSubscriptionResponse:
    return TelegramSubscriptionResponse(
        id=subscription.id,
        chat_id=subscription.chat_id,
        topics=subscription.topics or [],
        scheduled_search_notifications_enabled=SCHEDULED_SEARCH_TOPIC in (subscription.topics or []),
        enabled=subscription.enabled,
        created_at=subscription.created_at.isoformat(),
        updated_at=subscription.updated_at.isoformat(),
    )


def _normalize_bot_username(value: str) -> str:
    return value.strip().removeprefix("@")
