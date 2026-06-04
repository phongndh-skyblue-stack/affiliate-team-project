from __future__ import annotations

import secrets

from redis.asyncio import Redis

from app.core.config import settings

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def get_verification_ttl_seconds() -> int:
    return max(60, settings.TELEGRAM_VERIFICATION_TTL_SECONDS)


async def generate_verification_code(user_id: str, expire_seconds: int | None = None) -> str:
    code = f"verify_{secrets.token_urlsafe(12)}"
    await get_redis().setex(f"tg_verify:{code}", expire_seconds or get_verification_ttl_seconds(), user_id)
    return code


async def get_user_id_from_code(code: str) -> str | None:
    return await get_redis().get(f"tg_verify:{code}")


async def delete_verification_code(code: str) -> None:
    await get_redis().delete(f"tg_verify:{code}")
