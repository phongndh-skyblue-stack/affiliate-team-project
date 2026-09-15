from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.notifications.schema import NotificationListResponse
from app.api.notifications.service import NotificationService
from app.core.database import get_db
from app.shared.deps import get_current_user
from app.shared.responses import MessageResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total, unread, items = NotificationService(db).list_for_user(
        current_user.id, skip=skip, limit=limit
    )
    return NotificationListResponse(total=total, unread_count=unread, items=items)


@router.post("/read", response_model=MessageResponse)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = NotificationService(db).mark_all_read(current_user.id)
    return MessageResponse(message=f"Đã đánh dấu {count} thông báo là đã đọc.")


@router.delete("/{notification_id}", response_model=MessageResponse)
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = NotificationService(db).delete(notification_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thông báo không tồn tại.")
    return MessageResponse(message="Đã xóa thông báo.")


@router.delete("", response_model=MessageResponse)
def delete_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = NotificationService(db).delete_all(current_user.id)
    return MessageResponse(message=f"Đã xóa {count} thông báo.")
