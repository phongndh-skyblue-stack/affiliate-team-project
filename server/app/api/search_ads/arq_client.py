from __future__ import annotations

from datetime import datetime
from urllib.parse import urlparse

from arq import create_pool
from arq.connections import RedisSettings

from app.core.config import settings


def get_arq_redis_settings() -> RedisSettings:
    dsn = settings.arq_redis_dsn
    parsed = urlparse(dsn)
    if parsed.scheme.startswith("redis") and parsed.hostname:
        db = int(parsed.path.lstrip("/") or settings.REDIS_DB)
        return RedisSettings(
            host=parsed.hostname,
            port=parsed.port or settings.REDIS_PORT,
            database=db,
            password=parsed.password or settings.REDIS_PASSWORD or None,
        )
    return RedisSettings(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        database=settings.REDIS_DB,
        password=settings.REDIS_PASSWORD or None,
    )


async def enqueue_search_ads_schedule(schedule_id: str, run_at: datetime):
    redis = await create_pool(get_arq_redis_settings(), default_queue_name=settings.ARQ_QUEUE_NAME)
    try:
        return await redis.enqueue_job(
            "run_scheduled_search_ads",
            schedule_id,
            _defer_until=run_at,
            _queue_name=settings.ARQ_QUEUE_NAME,
        )
    finally:
        close = getattr(redis, "aclose", None)
        if close is not None:
            await close()
        else:
            redis.close()
            wait_closed = getattr(redis, "wait_closed", None)
            if wait_closed is not None:
                await wait_closed()
