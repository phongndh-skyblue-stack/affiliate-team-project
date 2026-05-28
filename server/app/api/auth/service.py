from __future__ import annotations

from fastapi import status
from sqlalchemy.orm import Session

from app.api.auth.repository import UserRepository
from app.api.auth.schema import AccessTokenResponse, AuthResponse, LoginRequest, RegisterRequest, UserRead
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.shared.constants import DEFAULT_USER_ROLE, REFRESH_TOKEN_TYPE
from app.shared.exceptions import AppHTTPException
from app.shared.responses import MessageResponse


class AuthService:
    def __init__(self, db: Session):
        self.repository = UserRepository(db)

    def register(self, payload: RegisterRequest) -> AuthResponse:
        if self.repository.get_by_username(payload.username):
            raise AppHTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists.")

        if self.repository.get_by_email(payload.email):
            raise AppHTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists.")

        user = self.repository.create_user(
            username=payload.username,
            email=payload.email,
            password_hash=get_password_hash(payload.password),
            role=DEFAULT_USER_ROLE,
        )
        return self._build_auth_response(user.id)

    def login(self, payload: LoginRequest) -> AuthResponse:
        user = self.repository.get_by_username(payload.username)
        if not user or not verify_password(payload.password, user.password_hash):
            raise AppHTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")

        return self._build_auth_response(user.id)

    def refresh(self, refresh_token: str) -> AccessTokenResponse:
        token_payload = decode_token(refresh_token, expected_type=REFRESH_TOKEN_TYPE)
        user = self.repository.get_by_id(token_payload.sub)
        if not user:
            raise AppHTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists.")

        return AccessTokenResponse(accessToken=create_access_token(user.id))

    def logout(self) -> MessageResponse:
        return MessageResponse(message="Logged out successfully.")

    def _build_auth_response(self, user_id: str) -> AuthResponse:
        user = self.repository.get_by_id(user_id)
        if not user:
            raise AppHTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        return AuthResponse(
            accessToken=create_access_token(user.id),
            refreshToken=create_refresh_token(user.id),
            user=UserRead.model_validate(user),
        )
