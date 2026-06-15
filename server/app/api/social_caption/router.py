from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth.model import User
from app.api.social_caption import service
from app.api.social_caption.platform_specs import GOALS, LANGUAGES, PLATFORMS
from app.api.social_caption.schema import (
    CaptionGenerateRequest,
    CaptionGenerateResponse,
)
from app.shared.deps import get_current_user

router = APIRouter(
    prefix="/social-caption",
    tags=["Social Caption Writer"],
)


@router.get("/options", summary="Danh sách nền tảng / mục tiêu / ngôn ngữ hỗ trợ")
def get_options() -> dict:
    return {
        "platforms": [
            {
                "value": p["value"],
                "label": p["label"],
                "charLimit": p["char_limit"],
                "hookCutoff": p["hook_cutoff"],
            }
            for p in PLATFORMS
        ],
        "goals": [{"value": g["value"], "label": g["label"]} for g in GOALS],
        "languages": LANGUAGES,
    }


@router.post(
    "/generate",
    response_model=CaptionGenerateResponse,
    summary="Sinh caption mạng xã hội đa nền tảng (compliant-by-design)",
)
async def generate_caption(
    payload: CaptionGenerateRequest,
    current_user: User = Depends(get_current_user),
) -> CaptionGenerateResponse:
    try:
        return await service.generate(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi sinh caption: {exc}") from exc
