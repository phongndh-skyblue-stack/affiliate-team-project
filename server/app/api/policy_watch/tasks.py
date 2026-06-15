"""ARQ cron task: kiểm tra chính sách Google Ads mỗi giờ.

Được đăng ký vào WorkerSettings của worker chung
(`arq app.api.search_ads.tasks.WorkerSettings`).
"""

from __future__ import annotations

import logging

from app.core.database import SessionLocal

logger = logging.getLogger(__name__)


async def check_google_ads_policies(ctx) -> dict:
    # ARQ chạy ngoài import graph của FastAPI router — nạp FK targets thủ công.
    import app.api.auth.model  # noqa: F401
    import app.api.telegram.model  # noqa: F401

    from app.api.policy_watch.service import check_policy_sources

    db = SessionLocal()
    try:
        result = await check_policy_sources(db)
        logger.info("Policy watch cron: %s", result)
        return result
    finally:
        db.close()
