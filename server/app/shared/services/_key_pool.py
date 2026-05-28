from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


class KeyPool:
    """Round-robin API key pool với cơ chế xoay vòng khi key bị hết quota.

    Cách dùng:
        pool = KeyPool(["key1", "key2", "key3"])
        key = pool.current          # Lấy key hiện tại
        await pool.rotate()         # Xoay sang key tiếp theo
        exhausted = pool.all_tried  # Kiểm tra đã thử hết chưa
    """

    def __init__(self, keys: list[str], name: str = "API") -> None:
        if not keys:
            raise ValueError(
                f"{name} KeyPool requires at least one key. "
                "Check your environment variables."
            )
        self._keys = keys
        self._name = name
        self._index = 0
        self._tried: set[int] = set()
        self._lock = asyncio.Lock()

    @property
    def current(self) -> str:
        return self._keys[self._index]

    @property
    def all_tried(self) -> bool:
        return len(self._tried) >= len(self._keys)

    def mark_current_tried(self) -> None:
        self._tried.add(self._index)

    async def rotate(self) -> str:
        async with self._lock:
            self._tried.add(self._index)
            self._index = (self._index + 1) % len(self._keys)
            logger.warning(
                "[%s] Key index %d exhausted, rotated to index %d",
                self._name,
                (self._index - 1) % len(self._keys),
                self._index,
            )
            return self._keys[self._index]

    def reset_tried(self) -> None:
        """Xóa lịch sử đã thử — gọi sau khi quota reset."""
        self._tried.clear()

    def __len__(self) -> int:
        return len(self._keys)

    def __repr__(self) -> str:
        return f"KeyPool(name={self._name!r}, total={len(self._keys)}, current={self._index})"
