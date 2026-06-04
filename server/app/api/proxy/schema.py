from __future__ import annotations

from pydantic import Field

from app.shared.responses import CamelModel


class ProxyCreate(CamelModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tên nhận diện proxy")
    protocol: str = Field("http", description="Giao thức: http, https, socks5")
    host: str = Field(..., description="Host hoặc IP")
    port: str = Field(..., description="Port")
    username: str | None = Field(None, description="Tên đăng nhập (tuỳ chọn)")
    password: str | None = Field(None, description="Mật khẩu (sẽ được mã hoá)")


class ProxyUpdate(CamelModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    protocol: str | None = None
    host: str | None = None
    port: str | None = None
    username: str | None = None
    password: str | None = None


class ProxyResponse(CamelModel):
    id: str
    name: str
    protocol: str
    host: str
    port: str
    username: str | None = None
    has_password: bool
    created_at: str
    updated_at: str


class ProxyListResponse(CamelModel):
    total: int
    items: list[ProxyResponse] = Field(default_factory=list)
