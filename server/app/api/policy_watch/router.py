from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.policy_watch import service
from app.api.policy_watch.schema import (
    PolicyChangeListResponse,
    PolicyCheckResult,
    PolicySnapshotStatus,
    PolicyWatchStatusResponse,
)
from app.core.database import get_db
from app.shared.deps import get_current_user

router = APIRouter(
    prefix="/policy-watch",
    tags=["Google Ads Policy Watch"],
)


@router.get(
    "/changes",
    response_model=PolicyChangeListResponse,
    summary="Danh sách các lần chính sách Google Ads thay đổi (mới nhất trước)",
)
def get_policy_changes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PolicyChangeListResponse:
    items = service.list_recent_changes(db)
    return PolicyChangeListResponse(total=len(items), items=items)


@router.get(
    "/status",
    response_model=PolicyWatchStatusResponse,
    summary="Trạng thái các nguồn chính sách đang theo dõi",
)
def get_policy_watch_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PolicyWatchStatusResponse:
    snapshots = service.list_snapshots(db)
    return PolicyWatchStatusResponse(
        sources=[
            PolicySnapshotStatus(
                source_url=s.source_url,
                platform=s.platform,
                title=s.title,
                fetched_at=s.fetched_at,
                changed_at=s.changed_at,
            )
            for s in snapshots
        ]
    )


@router.post(
    "/check",
    response_model=PolicyCheckResult,
    summary="Kiểm tra thủ công ngay lập tức (không cần chờ cron hàng giờ)",
)
async def trigger_policy_check(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PolicyCheckResult:
    result = await service.check_policy_sources(db)
    return PolicyCheckResult(**result)
