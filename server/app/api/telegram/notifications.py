from __future__ import annotations

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.telegram.model import TelegramSubscription
from app.api.telegram.service import SCHEDULED_SEARCH_TOPIC
from app.core.config import settings


async def send_scheduled_search_done_notification(db: Session, user_id: str, message: str) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN:
        return False

    stmt = select(TelegramSubscription).where(
        TelegramSubscription.user_id == user_id,
        TelegramSubscription.enabled.is_(True),
    )
    subscription = db.scalar(stmt)
    if not subscription or SCHEDULED_SEARCH_TOPIC not in (subscription.topics or []):
        return False

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            url,
            json={
                "chat_id": subscription.chat_id,
                "text": message,
                "disable_web_page_preview": True,
            },
        )
        response.raise_for_status()
    return True
