from __future__ import annotations

from sqlalchemy.orm import Session

from app.api.proxy.model import Proxy


class ProxyRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, user_id: str, **kwargs) -> Proxy:
        proxy = Proxy(user_id=user_id, **kwargs)
        self.db.add(proxy)
        self.db.commit()
        self.db.refresh(proxy)
        return proxy

    def list_by_user(self, user_id: str) -> list[Proxy]:
        return (
            self.db.query(Proxy)
            .filter(Proxy.user_id == user_id)
            .order_by(Proxy.created_at.desc())
            .all()
        )

    def get(self, proxy_id: str, user_id: str) -> Proxy | None:
        return (
            self.db.query(Proxy)
            .filter(Proxy.id == proxy_id, Proxy.user_id == user_id)
            .first()
        )

    def update(self, proxy: Proxy, **kwargs) -> Proxy:
        for k, v in kwargs.items():
            setattr(proxy, k, v)
        self.db.commit()
        self.db.refresh(proxy)
        return proxy

    def delete(self, proxy: Proxy) -> None:
        self.db.delete(proxy)
        self.db.commit()

    def get_any(self, proxy_id: str) -> Proxy | None:
        """Load proxy without user ownership check (for internal use by search service)."""
        return self.db.query(Proxy).filter(Proxy.id == proxy_id).first()
