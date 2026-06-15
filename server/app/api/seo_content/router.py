from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.seo_content.schema import (
    SeoContentCreate,
    SeoContentUpdate,
    SeoContentResponse,
    SeoContentListResponse,
    SeoScoreRequest,
    SeoScoreResponse,
    SeoResearchRequest,
    SeoResearchResponse,
)
from app.api.seo_content.service import SeoContentService
from app.api.seo_content import ai_research
from app.core.database import get_db
from app.shared.deps import get_current_user
from app.shared.responses import success_response

router = APIRouter(
    prefix="/seo-content",
    tags=["SEO Content Builder"],
)


def get_service(db: Session = Depends(get_db)) -> SeoContentService:
    return SeoContentService(db)


@router.post(
    "/score",
    response_model=SeoScoreResponse,
    summary="Tính điểm SEO và phân tích từ khóa on-the-fly",
)
def calculate_seo_score(
    payload: SeoScoreRequest,
    current_user: User = Depends(get_current_user),
    service: SeoContentService = Depends(get_service),
) -> SeoScoreResponse:
    return service.calculate_seo_score(payload)


@router.post(
    "/",
    response_model=SeoContentResponse,
    summary="Lưu bản ghi SEO Content mới",
)
def create_seo_content(
    payload: SeoContentCreate,
    current_user: User = Depends(get_current_user),
    service: SeoContentService = Depends(get_service),
) -> SeoContentResponse:
    return service.create(current_user.id, payload)


@router.get(
    "/",
    response_model=SeoContentListResponse,
    summary="Lấy danh sách các bản ghi SEO Content của user",
)
def get_seo_contents(
    current_user: User = Depends(get_current_user),
    service: SeoContentService = Depends(get_service),
) -> SeoContentListResponse:
    items = service.list_by_user_id(current_user.id)
    return SeoContentListResponse(total=len(items), items=items)


@router.get(
    "/{item_id}",
    response_model=SeoContentResponse,
    summary="Chi tiết một bản ghi SEO Content",
)
def get_seo_content_detail(
    item_id: str,
    current_user: User = Depends(get_current_user),
    service: SeoContentService = Depends(get_service),
) -> SeoContentResponse:
    return service.get_by_id(item_id, current_user.id)


@router.put(
    "/{item_id}",
    response_model=SeoContentResponse,
    summary="Cập nhật một bản ghi SEO Content",
)
def update_seo_content(
    item_id: str,
    payload: SeoContentUpdate,
    current_user: User = Depends(get_current_user),
    service: SeoContentService = Depends(get_service),
) -> SeoContentResponse:
    return service.update(current_user.id, item_id, payload)


@router.delete(
    "/{item_id}",
    status_code=204,
    response_model=None,
    summary="Xóa một bản ghi SEO Content",
)
def delete_seo_content(
    item_id: str,
    current_user: User = Depends(get_current_user),
    service: SeoContentService = Depends(get_service),
) -> None:
    service.delete(current_user.id, item_id)


@router.post(
    "/research",
    response_model=SeoResearchResponse,
    summary="Deep Research với Gemini AI — tự động tạo SEO content từ link affiliate",
)
async def research_seo_content(
    payload: SeoResearchRequest,
    current_user: User = Depends(get_current_user),
) -> SeoResearchResponse:
    """
    Dùng Gemini AI + Tavily Search + Web Crawling để tự động nghiên cứu
    dự án affiliate và trả về bộ SEO content + Google Ads assets hoàn chỉnh.

    - **project_name**: Tên dự án (vd: "Elfsight", "iClosed")
    - **affiliate_url**: Link trang affiliate (vd: "https://elfsight.com")
    """
    try:
        result = await ai_research.research_project(
            project_name=payload.project_name,
            affiliate_url=payload.affiliate_url,
        )
        return SeoResearchResponse(
            keywords=result.keywords,
            seo_title=result.seo_title,
            meta_description=result.meta_description,
            headlines=result.headlines,
            descriptions=result.descriptions,
            display_path=result.display_path,
            body_content=result.body_content,
            user_persona=result.user_persona,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi khi thực hiện AI Research: {exc}",
        ) from exc
