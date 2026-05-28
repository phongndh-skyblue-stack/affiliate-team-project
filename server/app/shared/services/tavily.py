"""Tavily service — Web search AI.

Docs: https://docs.tavily.com/docs/rest-api/api-reference
Tất cả hàm đều async và tự xoay key khi gặp 429 / quota hết.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

import httpx

from app.core.config import settings
from app.shared.services._key_pool import KeyPool

logger = logging.getLogger(__name__)

_TAVILY_URL = "https://api.tavily.com/search"

_pool: KeyPool | None = None


def _get_pool() -> KeyPool:
    global _pool
    if _pool is None:
        _pool = KeyPool(settings.tavily_keys, name="Tavily")
    return _pool


async def _request(payload: dict[str, Any]) -> dict[str, Any]:
    """Gửi POST request đến Tavily, tự xoay key khi bị 429."""
    pool = _get_pool()
    pool.reset_tried()

    while not pool.all_tried:
        pool.mark_current_tried()
        key = pool.current

        try:
            async with httpx.AsyncClient(timeout=60.0, trust_env=False) as client:
                resp = await client.post(
                    _TAVILY_URL,
                    json={**payload, "api_key": key},
                    headers={"Content-Type": "application/json"},
                )

            if resp.status_code == 429:
                logger.warning("Tavily quota hết cho key ...%s, đang xoay...", key[-6:])
                await pool.rotate()
                continue

            resp.raise_for_status()
            return resp.json()

        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                logger.warning("Tavily quota hết cho key ...%s, đang xoay...", key[-6:])
                await pool.rotate()
                continue
            logger.error("Tavily HTTP error %d: %s", exc.response.status_code, exc.response.text)
            raise

        except httpx.RequestError as exc:
            logger.error("Tavily request error: %s", exc)
            raise

    raise RuntimeError(
        "Tất cả Tavily keys đã hết quota. Vui lòng thêm key mới vào TAVILY_KEYS."
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def tavily_search(
    query: str,
    search_depth: Literal["basic", "advanced"] = "basic",
    topic: Literal["general", "news"] = "general",
    max_results: int = 10,
    days: int | None = None,
    include_answer: bool = False,
    include_raw_content: bool = False,
    include_images: bool = False,
    include_image_descriptions: bool = False,
    include_domains: list[str] | None = None,
    exclude_domains: list[str] | None = None,
) -> dict[str, Any]:
    """Tìm kiếm web thông qua Tavily AI Search.

    Args:
        query:                    Từ khóa tìm kiếm.
        search_depth:             "basic" (nhanh) hoặc "advanced" (sâu hơn, tốn credit).
        topic:                    "general" hoặc "news" (tìm tin tức).
        max_results:              Số kết quả tối đa (1–20).
        days:                     Số ngày gần đây (chỉ áp dụng khi topic="news").
        include_answer:           Trả về câu trả lời tóm tắt từ AI.
        include_raw_content:      Trả về nội dung thô của trang.
        include_images:           Trả về danh sách hình ảnh.
        include_image_descriptions: Trả về mô tả hình ảnh.
        include_domains:          Chỉ tìm trong các domain này.
        exclude_domains:          Loại trừ các domain này.

    Returns:
        Dict với các key:
            - query:    Từ khóa đã tìm.
            - answer:   Câu trả lời tóm tắt (nếu include_answer=True).
            - results:  List[{title, url, content, score, published_date}].
            - images:   List URL hình ảnh (nếu include_images=True).
    """
    payload: dict[str, Any] = {
        "query": query,
        "search_depth": search_depth,
        "topic": topic,
        "max_results": max(1, min(max_results, 20)),
        "include_answer": include_answer,
        "include_raw_content": include_raw_content,
        "include_images": include_images,
        "include_image_descriptions": include_image_descriptions,
    }

    if days is not None:
        payload["days"] = days
    if include_domains:
        payload["include_domains"] = include_domains
    if exclude_domains:
        payload["exclude_domains"] = exclude_domains

    return await _request(payload)
