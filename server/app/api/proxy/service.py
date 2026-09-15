from __future__ import annotations

import base64
import hashlib
from urllib.parse import urlparse

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.proxy.model import Proxy
from app.api.proxy.repository import ProxyRepository
from app.api.proxy.schema import ProxyCreate, ProxyListResponse, ProxyResponse, ProxyUpdate
from app.core.config import settings


_FERNETS = None


def _coerce_fernet_key(key: str) -> bytes:
    """Accept either a Fernet key or a configured passphrase."""
    try:
        from cryptography.fernet import Fernet

        encoded = key.encode()
        Fernet(encoded)
        return encoded
    except ValueError:
        return base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())


def _get_fernets():
    """Return Fernet instances for current key followed by fallback keys."""
    global _FERNETS
    if _FERNETS is not None:
        return _FERNETS

    try:
        from cryptography.fernet import Fernet

        key = settings.PROXY_ENCRYPTION_KEY.strip()
        if not key:
            # Generate a volatile key so the server still boots in dev without config
            key = Fernet.generate_key().decode()
        keys = [key, *settings.proxy_encryption_key_fallbacks]
        _FERNETS = [Fernet(_coerce_fernet_key(item)) for item in keys]
        return _FERNETS
    except ImportError:
        raise RuntimeError("cryptography package is required for proxy password encryption. Run: pip install cryptography")


def _get_fernet():
    return _get_fernets()[0]


def encrypt_password(password: str) -> str:
    return _get_fernet().encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    try:
        from cryptography.fernet import InvalidToken
    except ImportError:
        raise RuntimeError("cryptography package is required for proxy password encryption. Run: pip install cryptography")

    token = encrypted.encode()
    for fernet in _get_fernets():
        try:
            return fernet.decrypt(token).decode()
        except InvalidToken:
            continue

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Không giải mã được mật khẩu proxy. Vui lòng cập nhật lại mật khẩu proxy.",
    )


def _build_proxy_server(protocol: str, host: str, port: str) -> str:
    protocol = (protocol or "http").strip().lower()
    host = (host or "").strip()
    port = (port or "").strip()

    parsed = urlparse(host)
    if parsed.scheme and parsed.netloc:
        host = parsed.hostname or parsed.netloc
        if parsed.port and not port:
            port = str(parsed.port)

    return f"{protocol}://{host}:{port}"


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
            "server": _build_proxy_server(proxy.protocol, proxy.host, proxy.port),
            "username": proxy.username,
            "password": password,
        }
