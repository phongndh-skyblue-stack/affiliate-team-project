from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.auth.model import User
from app.api.users.schema import UserRead
from app.api.users.service import UserService
from app.shared.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserService.get_me(current_user)
