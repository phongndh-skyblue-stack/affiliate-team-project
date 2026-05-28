from __future__ import annotations

from fastapi import Depends, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.auth.repository import UserRepository
from app.core.database import get_db
from app.core.security import decode_token
from app.shared.constants import ACCESS_TOKEN_TYPE
from app.shared.exceptions import AppHTTPException

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise AppHTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    token_payload = decode_token(token, expected_type=ACCESS_TOKEN_TYPE)
    user = UserRepository(db).get_by_id(token_payload.sub)

    if not user:
        raise AppHTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found for token.",
        )

    return user
