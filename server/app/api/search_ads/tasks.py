from __future__ import annotations

from datetime import UTC, timedelta
from zoneinfo import ZoneInfo

from arq import cron
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.policy_watch.tasks import check_google_ads_policies
from app.api.search_ads.arq_client import get_arq_redis_settings
from app.api.search_ads.model import GoogleAdsSearch, GoogleAdsSearchAd, GoogleAdsSearchSchedule
from app.api.search_ads.repository import SearchAdsRepository
from app.api.search_ads.schema import SearchAdsRequest
from app.api.search_ads.service import SearchAdsService
from app.api.telegram.model import TelegramSubscription
from app.api.telegram.notifications import send_telegram_message
from app.core.config import settings
from app.core.database import SessionLocal


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

        await _notify_if_top1_changed(db, schedule.id)
        await _enqueue_next_daily_run(db, schedule.id)
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
            await _enqueue_next_daily_run(db, schedule.id)
        raise
    finally:
        db.close()


class WorkerSettings:
    functions = [run_scheduled_search_ads]
    # Cron: kiểm tra chính sách Google Ads mỗi giờ (phút 0)
    cron_jobs = [cron(check_google_ads_policies, minute=0)]
    redis_settings = get_arq_redis_settings()
    queue_name = settings.ARQ_QUEUE_NAME
    max_jobs = 2
    job_timeout = 60 * 30


async def _notify_if_top1_changed(db, schedule_id: str) -> None:
    try:
        schedule = SearchAdsRepository(db).get_schedule(schedule_id)
        if (
            not schedule
            or not schedule.user_id
            or not schedule.search_id
            or not schedule.batch_id
            or schedule.notification_sent
            or not schedule.notify_telegram_on_change
        ):
            return

        current_search = db.scalar(
            select(GoogleAdsSearch)
            .options(selectinload(GoogleAdsSearch.ads))
            .where(GoogleAdsSearch.id == schedule.search_id)
        )
        current_ad = _top_ad(current_search)
        if not current_ad:
            return

        previous_schedule = _previous_done_schedule(db, schedule)
        if not previous_schedule or not previous_schedule.search_id:
            return

        previous_search = db.scalar(
            select(GoogleAdsSearch)
            .options(selectinload(GoogleAdsSearch.ads))
            .where(GoogleAdsSearch.id == previous_schedule.search_id)
        )
        previous_ad = _top_ad(previous_search)
        if not previous_ad:
            return
        if _advertiser_key(previous_ad) == _advertiser_key(current_ad):
            return

        subscription = db.scalar(
            select(TelegramSubscription).where(
                TelegramSubscription.user_id == schedule.user_id,
                TelegramSubscription.enabled.is_(True),
            )
        )
        if not subscription:
            return

        sent = await send_telegram_message(
            subscription.chat_id,
            _build_top1_changed_message(schedule, previous_ad, current_ad),
        )
        if sent:
            schedule.notification_sent = True
            db.commit()
    except Exception:
        db.rollback()


async def _enqueue_next_daily_run(db, schedule_id: str) -> None:
    try:
        schedule = SearchAdsRepository(db).get_schedule(schedule_id)
        if not schedule or schedule.schedule_mode != "daily" or not schedule.daily_time:
            return
        if schedule.status == "cancelled" or _has_future_daily_run(db, schedule):
            return

        from app.api.search_ads.arq_client import enqueue_search_ads_schedule

        next_run_at = _next_daily_run_after(schedule.run_at, schedule.daily_time)
        next_schedule = SearchAdsRepository(db).create_schedule(
            user_id=schedule.user_id,
            keyword=schedule.keyword,
            location=schedule.location,
            language=schedule.language,
            device=schedule.device,
            no_proxy=schedule.no_proxy,
            headful=schedule.headful,
            proxy_id=schedule.proxy_id,
            proxy_name=schedule.proxy_name,
            batch_id=schedule.batch_id,
            run_at=next_run_at,
            schedule_mode=schedule.schedule_mode,
            daily_time=schedule.daily_time,
            notify_telegram_on_change=schedule.notify_telegram_on_change,
        )
        try:
            job = await enqueue_search_ads_schedule(next_schedule.id, next_run_at)
        except Exception:
            db.delete(next_schedule)
            db.commit()
            raise
        next_schedule.arq_job_id = job.job_id if job else None
        next_schedule.status = "enqueued"
        db.commit()
    except Exception:
        db.rollback()


def _previous_done_schedule(db, schedule: GoogleAdsSearchSchedule) -> GoogleAdsSearchSchedule | None:
    conditions = [
        GoogleAdsSearchSchedule.user_id == schedule.user_id,
        GoogleAdsSearchSchedule.batch_id == schedule.batch_id,
        GoogleAdsSearchSchedule.status == "done",
        GoogleAdsSearchSchedule.search_id.is_not(None),
        GoogleAdsSearchSchedule.run_at < schedule.run_at,
    ]
    if schedule.daily_time:
        conditions.append(GoogleAdsSearchSchedule.daily_time == schedule.daily_time)

    return db.scalar(
        select(GoogleAdsSearchSchedule)
        .where(*conditions)
        .order_by(GoogleAdsSearchSchedule.run_at.desc(), GoogleAdsSearchSchedule.id.desc())
    )


def _top_ad(search: GoogleAdsSearch | None) -> GoogleAdsSearchAd | None:
    if not search or not search.ads:
        return None
    return sorted(search.ads, key=lambda ad: (ad.position or 9999, ad.created_at))[0]


def _advertiser_key(ad: GoogleAdsSearchAd) -> str:
    value = ad.advertiser_name or ad.advertiser_domain or ad.display_url or ad.title or ""
    return " ".join(value.lower().strip().split())


def _advertiser_label(ad: GoogleAdsSearchAd) -> str:
    return ad.advertiser_name or ad.advertiser_domain or ad.display_url or ad.title or "Khong ro"


def _build_top1_changed_message(
    schedule: GoogleAdsSearchSchedule,
    previous_ad: GoogleAdsSearchAd,
    current_ad: GoogleAdsSearchAd,
) -> str:
    run_at = schedule.run_at
    if run_at.tzinfo is None:
        run_at = run_at.replace(tzinfo=UTC)
    local_run_at = run_at.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).strftime("%d/%m/%Y %H:%M")

    lines = [
        "Top 1 Google Ads da thay doi",
        f"Tu khoa: {schedule.keyword}",
        f"Thoi gian quet: {local_run_at}",
        f"Truoc: {_advertiser_label(previous_ad)}",
        f"Hien tai: {_advertiser_label(current_ad)}",
    ]
    return "\n".join(lines)


def _has_future_daily_run(db, schedule: GoogleAdsSearchSchedule) -> bool:
    return bool(
        db.scalar(
            select(GoogleAdsSearchSchedule.id)
            .where(
                GoogleAdsSearchSchedule.user_id == schedule.user_id,
                GoogleAdsSearchSchedule.batch_id == schedule.batch_id,
                GoogleAdsSearchSchedule.schedule_mode == "daily",
                GoogleAdsSearchSchedule.daily_time == schedule.daily_time,
                GoogleAdsSearchSchedule.run_at > schedule.run_at,
                GoogleAdsSearchSchedule.status.in_(["pending", "enqueued", "running"]),
            )
            .limit(1)
        )
    )


def _next_daily_run_after(value, daily_time: str):
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    hour, minute = (int(part) for part in daily_time.split(":", 1))
    local_value = value.astimezone(tz)
    next_value = local_value.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(days=1)
    return next_value.astimezone(UTC)
