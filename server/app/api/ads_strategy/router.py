from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.ads_strategy.schema import AdsStrategyRequest, AdsStrategyResponse
from app.api.ads_strategy.service import AdsStrategyService
from app.api.auth.model import User
from app.core.database import get_db
from app.shared.deps import get_current_user

router = APIRouter(prefix="/ads-strategy", tags=["Ads Strategy"])


def get_service(db: Session = Depends(get_db)) -> AdsStrategyService:
    return AdsStrategyService(db)


@router.post("/brief", response_model=AdsStrategyResponse)
def build_ads_strategy_brief(
    payload: AdsStrategyRequest,
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> AdsStrategyResponse:
    return service.build(current_user.id, payload)
