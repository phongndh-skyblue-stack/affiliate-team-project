from __future__ import annotations

import base64
import os

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.proxy.model import Proxy
from app.api.proxy.repository import ProxyRepository
from app.api.proxy.schema import ProxyCreate, ProxyListResponse, ProxyResponse, ProxyUpdate
from app.core.config import settings


def _get_fernet():
    """Return a Fernet instance if PROXY_ENCRYPTION_KEY is configured."""
    try:
        from cryptography.fernet import Fernet

        key = settings.PROXY_ENCRYPTION_KEY.strip()
        if not key:
            # Generate a volatile key so the server still boots in dev without config
            key = Fernet.generate_key().decode()
        return Fernet(key.encode() if isinstance(key, str) else key)
    except ImportError:
        raise RuntimeError("cryptography package is required for proxy password encryption. Run: pip install cryptography")


def encrypt_password(password: str) -> str:
    return _get_fernet().encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()


def _to_response(proxy: Proxy) -> ProxyResponse:
    return ProxyResponse(
        id=proxy.id,
        name=proxy.name,
        protocol=proxy.protocol,
        host=proxy.host,
        port=proxy.port,
        username=proxy.username,
        has_password=bool(proxy.encrypted_password),
        created_at=proxy.created_at.isoformat(),
        updated_at=proxy.updated_at.isoformat(),
    )


class ProxyService:
    def __init__(self, db: Session) -> None:
        self.repo = ProxyRepository(db)

    def list(self, user_id: str) -> ProxyListResponse:
        proxies = self.repo.list_by_user(user_id)
        return ProxyListResponse(total=len(proxies), items=[_to_response(p) for p in proxies])

    def create(self, user_id: str, data: ProxyCreate) -> ProxyResponse:
        encrypted_password = encrypt_password(data.password) if data.password else None
        proxy = self.repo.create(
            user_id=user_id,
            name=data.name,
            protocol=data.protocol,
            host=data.host,
            port=data.port,
            username=data.username,
            encrypted_password=encrypted_password,
        )
        return _to_response(proxy)

    def get(self, proxy_id: str, user_id: str) -> ProxyResponse:
        proxy = self.repo.get(proxy_id, user_id)
        if not proxy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proxy không tồn tại")
        return _to_response(proxy)

    def update(self, proxy_id: str, user_id: str, data: ProxyUpdate) -> ProxyResponse:
        proxy = self.repo.get(proxy_id, user_id)
        if not proxy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proxy không tồn tại")
        updates: dict = {}
        if data.name is not None:
            updates["name"] = data.name
        if data.protocol is not None:
            updates["protocol"] = data.protocol
        if data.host is not None:
            updates["host"] = data.host
        if data.port is not None:
            updates["port"] = data.port
        if data.username is not None:
            updates["username"] = data.username
        if data.password is not None:
            updates["encrypted_password"] = encrypt_password(data.password)
        proxy = self.repo.update(proxy, **updates)
        return _to_response(proxy)

    def delete(self, proxy_id: str, user_id: str) -> None:
        proxy = self.repo.get(proxy_id, user_id)
        if not proxy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proxy không tồn tại")
        self.repo.delete(proxy)

    def resolve_proxy_config(self, proxy_id: str, user_id: str) -> dict:
        """Return a proxy dict usable by the search graph."""
        proxy = self.repo.get(proxy_id, user_id)
        if not proxy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proxy không tồn tại")
        password = decrypt_password(proxy.encrypted_password) if proxy.encrypted_password else None
        return {
            "enabled": True,
            "protocol": proxy.protocol,
            "host": proxy.host,
            "port": proxy.port,
            "username": proxy.username,
            "password": password,
        }
