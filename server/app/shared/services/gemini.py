"""Helper Gemini dùng chung — gọi generateContent qua HTTP REST, ép JSON,
có retry + fallback model khi quá tải (503/UNAVAILABLE).

Dùng cho mọi module cần structured output từ Gemini (SEO, social caption...).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Mã lỗi tạm thời — nên retry / fallback thay vì báo lỗi ngay
_TRANSIENT_STATUS = {429, 500, 502, 503, 504}


def _parse_json(raw: str) -> dict[str, Any]:
    """Parse JSON từ output Gemini, gỡ markdown fence nếu có."""
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().strip("`").strip()
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise ValueError(f"Không tìm thấy JSON trong response: {raw[:200]}")
    return json.loads(match.group())


async def _post_once(model_name: str, system_prompt: str, user_prompt: str,
                     temperature: float, max_output_tokens: int) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        resp.raise_for_status()
        data = resp.json()

    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError("Gemini không trả candidates nào")
    return candidates[0]["content"]["parts"][0]["text"]


async def generate_json(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.7,
    max_output_tokens: int = 4096,
) -> dict[str, Any]:
    """Gọi Gemini và trả về dict JSON đã parse.

    Thử model chính → model fallback; mỗi model retry với backoff khi gặp lỗi
    tạm thời. Lỗi vĩnh viễn (key sai, 400/403) raise ngay.
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY chưa được cấu hình trong file .env")

    models = [settings.GEMINI_MODEL or "gemini-2.5-flash"]
    if settings.GEMINI_FALLBACK_MODEL and settings.GEMINI_FALLBACK_MODEL not in models:
        models.append(settings.GEMINI_FALLBACK_MODEL)

    max_attempts = 3
    last_error = ""

    for model_name in models:
        for attempt in range(1, max_attempts + 1):
            try:
                logger.info("🤖 Gemini %s (lần %d/%d)", model_name, attempt, max_attempts)
                raw = await _post_once(
                    model_name, system_prompt, user_prompt, temperature, max_output_tokens
                )
                return _parse_json(raw)
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                last_error = f"HTTP {status}"
                logger.warning("Gemini %s lỗi HTTP %d: %s", model_name, status, exc.response.text[:200])
                if status not in _TRANSIENT_STATUS:
                    raise RuntimeError(f"Gemini API lỗi HTTP {status}: {exc.response.text[:300]}") from exc
                if attempt < max_attempts:
                    await asyncio.sleep(2 ** (attempt - 1))
            except (ValueError, KeyError, IndexError) as exc:
                last_error = f"parse lỗi: {exc}"
                logger.warning("Gemini %s: %s", model_name, last_error)
                if attempt < max_attempts:
                    await asyncio.sleep(1)
            except Exception as exc:  # noqa: BLE001 — lỗi mạng tạm thời
                last_error = str(exc)
                logger.warning("Gemini %s lỗi kết nối: %s", model_name, exc)
                if attempt < max_attempts:
                    await asyncio.sleep(2 ** (attempt - 1))

    raise RuntimeError(
        f"Gemini đang quá tải hoặc không phản hồi sau nhiều lần thử ({last_error}). "
        "Vui lòng thử lại sau ít phút."
    )
