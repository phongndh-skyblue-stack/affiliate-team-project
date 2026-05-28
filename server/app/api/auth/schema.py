from datetime import datetime

from pydantic import EmailStr, Field, model_validator

from app.shared.responses import CamelModel


class LoginRequest(CamelModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)


class RegisterRequest(CamelModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)
    confirm_password: str = Field(min_length=6, max_length=100)

    @model_validator(mode="after")
    def validate_password_confirmation(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class RefreshTokenRequest(CamelModel):
    refresh_token: str = Field(min_length=1)


class UserRead(CamelModel):
    id: str
    username: str
    email: EmailStr
    role: str
    created_at: datetime


class AuthResponse(CamelModel):
    access_token: str
    refresh_token: str
    user: UserRead


class AccessTokenResponse(CamelModel):
    access_token: str
