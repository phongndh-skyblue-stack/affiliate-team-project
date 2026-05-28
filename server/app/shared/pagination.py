from __future__ import annotations

from fastapi import Query

from app.shared.constants import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE


def pagination_params(
    page: int = Query(DEFAULT_PAGE, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
) -> dict[str, int]:
    return {
        "page": page,
        "pageSize": page_size,
        "offset": (page - 1) * page_size,
        "limit": page_size,
    }
