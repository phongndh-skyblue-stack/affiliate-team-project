from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.proxy.schema import ProxyCreate, ProxyListResponse, ProxyResponse, ProxyUpdate
from app.api.proxy.service import ProxyService
from app.core.database import get_db
from app.shared.deps import get_current_user

router = APIRouter(prefix="/proxies", tags=["Proxy"])


def get_service(db: Session = Depends(get_db)) -> ProxyService:
    return ProxyService(db)


@router.get("", response_model=ProxyListResponse, summary="Danh sách proxy của user")
def list_proxies(
    current_user: User = Depends(get_current_user),
    service: ProxyService = Depends(get_service),
) -> ProxyListResponse:
    return service.list(current_user.id)


@router.post("", response_model=ProxyResponse, status_code=201, summary="Tạo proxy mới")
def create_proxy(
    data: ProxyCreate,
    current_user: User = Depends(get_current_user),
    service: ProxyService = Depends(get_service),
) -> ProxyResponse:
    return service.create(current_user.id, data)


@router.get("/{proxy_id}", response_model=ProxyResponse, summary="Chi tiết proxy")
def get_proxy(
    proxy_id: str,
    current_user: User = Depends(get_current_user),
    service: ProxyService = Depends(get_service),
) -> ProxyResponse:
    return service.get(proxy_id, current_user.id)


@router.put("/{proxy_id}", response_model=ProxyResponse, summary="Cập nhật proxy")
def update_proxy(
    proxy_id: str,
    data: ProxyUpdate,
    current_user: User = Depends(get_current_user),
    service: ProxyService = Depends(get_service),
) -> ProxyResponse:
    return service.update(proxy_id, current_user.id, data)


@router.delete("/{proxy_id}", status_code=204, response_model=None, summary="Xoá proxy")
def delete_proxy(
    proxy_id: str,
    current_user: User = Depends(get_current_user),
    service: ProxyService = Depends(get_service),
) -> None:
    service.delete(proxy_id, current_user.id)
