from __future__ import annotations

from sqlalchemy.orm import Session

from app.api.notifications.model import Notification
from app.shared.utils import utc_now


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, user_id: str, type: str, payload: dict) -> Notification:
        n = Notification(user_id=user_id, type=type, payload=payload)
        self.db.add(n)
        self.db.commit()
        self.db.refresh(n)
        return n

    def list_for_user(self, user_id: str, skip: int = 0, limit: int = 50):
        from sqlalchemy import select, func

        total = self.db.scalar(
            select(func.count()).where(Notification.user_id == user_id)
        ) or 0
        unread = self.db.scalar(
            select(func.count()).where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
        ) or 0
        items = (
            self.db.execute(
                select(Notification)
                .where(Notification.user_id == user_id)
                .order_by(Notification.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            .scalars()
            .all()
        )
        return total, unread, items

    def mark_all_read(self, user_id: str) -> int:
        from sqlalchemy import update

        result = self.db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
            .values(is_read=True)
        )
        self.db.commit()
        return result.rowcount

    def delete(self, notification_id: str, user_id: str) -> bool:
        """Delete a single notification belonging to user. Returns True if deleted."""
        from sqlalchemy import select

        n = self.db.scalar(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        if not n:
            return False
        self.db.delete(n)
        self.db.commit()
        return True

    def delete_all(self, user_id: str) -> int:
        """Delete all notifications for user. Returns count deleted."""
        from sqlalchemy import delete as sa_delete

        result = self.db.execute(
            sa_delete(Notification).where(Notification.user_id == user_id)
        )
        self.db.commit()
        return result.rowcount
