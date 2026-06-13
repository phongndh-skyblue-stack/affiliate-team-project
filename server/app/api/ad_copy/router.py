from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.ad_copy.schema import AdCopyGenerateRequest, AdCopyGenerateResponse
from app.api.ad_copy.service import AdCopyService
from app.api.auth.model import User
from app.shared.deps import get_current_user

router = APIRouter(prefix="/ad-copy", tags=["Ad Copy"])


@router.post("/generate", response_model=AdCopyGenerateResponse)
async def generate_ad_copy(
    payload: AdCopyGenerateRequest,
    _: User = Depends(get_current_user),
) -> AdCopyGenerateResponse:
    try:
        return await AdCopyService().generate(payload)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
