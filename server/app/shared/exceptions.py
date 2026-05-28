from __future__ import annotations

from fastapi import HTTPException


class AppHTTPException(HTTPException):
    def __init__(self, *, status_code: int, detail: str):
        headers = {"WWW-Authenticate": "Bearer"} if status_code == 401 else None
        super().__init__(status_code=status_code, detail=detail, headers=headers)
