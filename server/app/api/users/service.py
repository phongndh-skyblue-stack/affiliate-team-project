from __future__ import annotations

from app.api.auth.model import User
from app.api.auth.schema import UserRead


class UserService:
    @staticmethod
    def get_me(user: User) -> UserRead:
        return UserRead.model_validate(user)
