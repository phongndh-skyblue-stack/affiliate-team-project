from __future__ import annotations

from datetime import UTC
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.api.search_ads.model import GoogleAdsSearch, GoogleAdsSearchSchedule
from app.api.search_ads.repository import SearchAdsRepository
from app.api.search_ads.arq_client import get_arq_redis_settings
from app.api.search_ads.schema import SearchAdsRequest
from app.api.search_ads.service import SearchAdsService
from app.api.telegram.notifications import send_scheduled_search_done_notification
from app.core.config import settings
from app.core.database import SessionLocal

TERMINAL_SCHEDULE_STATUSES = {"done", "failed", "cancelled"}


def _load_model_metadata() -> None:
    # ARQ starts outside FastAPI's router import graph, so load FK targets explicitly.
    import app.api.auth.model  # noqa: F401
    import app.api.telegram.model  # noqa: F401


async def run_scheduled_search_ads(ctx, schedule_id: str) -> dict:
    _load_model_metadata()
    db = SessionLocal()
    try:
        repo = SearchAdsRepository(db)
        schedule = repo.get_schedule(schedule_id)
        if not schedule:
            return {"status": "not_found", "schedule_id": schedule_id}
        if schedule.status == "cancelled":
            return {"status": "cancelled", "schedule_id": schedule_id}
        if schedule.status in {"running", "done"}:
            return {"status": schedule.status, "schedule_id": schedule_id}

        schedule.status = "running"
        schedule.error = None
        db.commit()

        payload = SearchAdsRequest(
            keyword=schedule.keyword,
            location=schedule.location,
            language=schedule.language,
            device=schedule.device,
            no_proxy=schedule.no_proxy,
            headful=schedule.headful,
            proxy_id=schedule.proxy_id,
        )
        service = SearchAdsService(db)
        response = await service.run_search(user_id=schedule.user_id, payload=payload, is_scheduled=True)

        schedule.status = "done"
        schedule.search_id = service.last_search_id
        db.commit()
        await _notify_if_batch_finished(db, schedule.id)
        return {
            "status": "done",
            "schedule_id": schedule_id,
            "search_id": service.last_search_id,
            "total_ads_found": response.total_ads_found,
        }
    except Exception as exc:
        db.rollback()
        schedule = SearchAdsRepository(db).get_schedule(schedule_id)
        if schedule:
            schedule.status = "failed"
            schedule.error = str(exc)
            db.commit()
            await _notify_if_batch_finished(db, schedule.id)
        raise
    finally:
        db.close()


class WorkerSettings:
    functions = [run_scheduled_search_ads]
    redis_settings = get_arq_redis_settings()
    queue_name = settings.ARQ_QUEUE_NAME
    max_jobs = 2
    job_timeout = 60 * 30


async def _notify_if_batch_finished(db, schedule_id: str) -> None:
    try:
        schedule = SearchAdsRepository(db).get_schedule(schedule_id)
        if not schedule or not schedule.user_id or not schedule.batch_id or schedule.notification_sent:
            return

        batch_schedules = list(
            db.scalars(
                select(GoogleAdsSearchSchedule)
                .where(
                    GoogleAdsSearchSchedule.user_id == schedule.user_id,
                    GoogleAdsSearchSchedule.batch_id == schedule.batch_id,
                )
                .order_by(GoogleAdsSearchSchedule.run_at.asc(), GoogleAdsSearchSchedule.id.asc())
            )
        )
        if not batch_schedules:
            return

        final_schedule = batch_schedules[-1]
        if final_schedule.id != schedule.id or final_schedule.notification_sent:
            return
        if any(item.status not in TERMINAL_SCHEDULE_STATUSES for item in batch_schedules):
            return

        search_ids = [item.search_id for item in batch_schedules if item.search_id]
        total_ads = 0
        if search_ids:
            searches = list(db.scalars(select(GoogleAdsSearch).where(GoogleAdsSearch.id.in_(search_ids))))
            total_ads = sum(search.total_ads_found for search in searches)

        done = sum(1 for item in batch_schedules if item.status == "done")
        failed = sum(1 for item in batch_schedules if item.status == "failed")
        cancelled = sum(1 for item in batch_schedules if item.status == "cancelled")
        message = _build_batch_done_message(
            final_schedule=final_schedule,
            total=len(batch_schedules),
            done=done,
            failed=failed,
            cancelled=cancelled,
            total_ads=total_ads,
        )
        sent = await send_scheduled_search_done_notification(db, schedule.user_id, message)
        if sent:
            final_schedule.notification_sent = True
            db.commit()
    except Exception:
        db.rollback()


def _build_batch_done_message(
    *,
    final_schedule: GoogleAdsSearchSchedule,
    total: int,
    done: int,
    failed: int,
    cancelled: int,
    total_ads: int,
) -> str:
    run_at = final_schedule.run_at
    if run_at.tzinfo is None:
        run_at = run_at.replace(tzinfo=UTC)
    local_run_at = run_at.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).strftime("%d/%m/%Y %H:%M")

    lines = [
        "Lịch quét quảng cáo đã hoàn tất",
        f"Từ khóa: {final_schedule.keyword}",
        f"Lần đặt lịch: {total} mốc, mốc cuối lúc {local_run_at}",
        f"Kết quả: {done} xong, {failed} lỗi, {cancelled} hủy",
        f"Tổng quảng cáo tìm thấy: {total_ads}",
    ]
    return "\n".join(lines)
