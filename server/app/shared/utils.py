from __future__ import annotations

from datetime import UTC, datetime


def snake_to_camel(value: str) -> str:
    chunks = value.split("_")
    return chunks[0] + "".join(chunk.capitalize() for chunk in chunks[1:])


def utc_now() -> datetime:
    return datetime.now(UTC)
