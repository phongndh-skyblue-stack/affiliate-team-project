from __future__ import annotations

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import status
from pydantic import BaseModel

from app.core.config import settings
from app.shared.constants import ACCESS_TOKEN_TYPE, REFRESH_TOKEN_TYPE
from app.shared.exceptions import AppHTTPException


class TokenPayload(BaseModel):
    sub: str
    type: str
    exp: int


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _build_token(subject: str, expires_delta: timedelta, token_type: str, secret: str) -> str:
    expires_at = datetime.now(UTC) + expires_delta
    payload = {
        "sub": subject,
        "type": token_type,
        "exp": expires_at,
    }
    return jwt.encode(payload, secret, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str) -> str:
    return _build_token(
        subject=subject,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type=ACCESS_TOKEN_TYPE,
        secret=settings.JWT_SECRET_KEY,
    )


def create_refresh_token(subject: str) -> str:
    return _build_token(
        subject=subject,
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type=REFRESH_TOKEN_TYPE,
        secret=settings.JWT_REFRESH_SECRET_KEY,
    )


def decode_token(token: str, expected_type: str = ACCESS_TOKEN_TYPE) -> TokenPayload:
    secret = settings.JWT_SECRET_KEY if expected_type == ACCESS_TOKEN_TYPE else settings.JWT_REFRESH_SECRET_KEY

    try:
        payload = jwt.decode(token, secret, algorithms=[settings.JWT_ALGORITHM])
        token_payload = TokenPayload.model_validate(payload)
    except jwt.ExpiredSignatureError as exc:
        raise AppHTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
        ) from exc
    except (jwt.InvalidTokenError, ValueError) as exc:
        raise AppHTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
        ) from exc

    if token_payload.type != expected_type:
        raise AppHTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )

    return token_payload
