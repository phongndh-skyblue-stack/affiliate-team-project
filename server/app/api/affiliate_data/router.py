"""affiliate_data API — quét traffic từ SimilarWeb Pro."""
from __future__ import annotations

import httpx

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.affiliate_data.schema import (
    AffiliateLinkCreateRequest,
    AffiliateLinkModel,
    AffiliateLinkDetailResponse,
    AffiliateLinkUpdateRequest,
    AffiliateProjectScanRequest,
    AffiliateProjectScanResponse,
    ScanTrafficRequest,
    ScanTrafficResponse,
    TrafficDetails,
)
from app.api.affiliate_data.service import AffiliateDataService
from app.core.database import get_db
from app.shared.deps import get_current_user

router = APIRouter(prefix="/affiliate-data", tags=["Affiliate Data"])


def get_service(db: Session = Depends(get_db)) -> AffiliateDataService:
    return AffiliateDataService(db)


@router.post(
    "/affiliate-link",
    response_model=AffiliateLinkModel,
    summary="Tạo/lưu affiliate link cho user hiện tại",
    responses={
        400: {"description": "Website/domain không hợp lệ"},
    },
)
def create_affiliate_link_endpoint(
    payload: AffiliateLinkCreateRequest,
    current_user: User = Depends(get_current_user),
    service: AffiliateDataService = Depends(get_service),
) -> AffiliateLinkModel:
    try:
        row = service.create_affiliate_link(current_user.id, payload.website, payload.name, payload.search)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return AffiliateLinkModel(**row)


@router.post(
    "/scan-traffic",
    response_model=ScanTrafficResponse,
    summary="Quét traffic chi tiết của 1 URL từ SimilarWeb Pro",
    responses={
        400: {"description": "URL không hợp lệ hoặc không thể xác định domain"},
        500: {"description": "Lỗi khi quét traffic (Selenium / network)"},
    },
)
async def scan_traffic_endpoint(
    payload: ScanTrafficRequest,
    current_user: User = Depends(get_current_user),
    service: AffiliateDataService = Depends(get_service),
) -> ScanTrafficResponse:
    """Quét traffic cho URL cho trước.

    - Cookie SimilarWeb Pro được cache và tự refresh khi hết hạn.
    - Trả về thống kê 4 tháng gần nhất: global engagement, top-50 quốc gia,
      traffic sources và mạng xã hội.
    """
    try:
        result = await service.create_traffic_scan(
            user_id=current_user.id,
            affiliate_link_id=payload.affiliate_link_id,
            months=payload.months,
            start_period=payload.start_period,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quét traffic thất bại: {exc}",
        )

    details_raw = result.get("traffic_details")
    traffic_details: TrafficDetails | None = None
    if details_raw:
        # alias "global" → "global_"
        traffic_details = TrafficDetails.model_validate(details_raw)

    return ScanTrafficResponse(
        domain=result["domain"],
        url=result["url"],
        found=result["found"],
        monthly_visits=result["monthly_visits"],
        period_month=result["period_month"],
        traffic_details=traffic_details,
    )


@router.post(
    "/scan-affiliate-project",
    response_model=AffiliateProjectScanResponse,
    summary="Quét thông tin dự án affiliate từ website",
    responses={
        400: {"description": "Website/domain không hợp lệ"},
        502: {"description": "Tavily trả lỗi HTTP"},
        503: {"description": "Hết quota key hoặc lỗi mạng khi gọi Tavily"},
    },
)
async def scan_affiliate_project_endpoint(
    payload: AffiliateProjectScanRequest,
    current_user: User = Depends(get_current_user),
    service: AffiliateDataService = Depends(get_service),
) -> AffiliateProjectScanResponse:
    """Tự động quét project name/link, event, sale và top 5 quốc gia từ website."""
    try:
        result = await service.create_project_scan(
            user_id=current_user.id,
            affiliate_link_id=payload.affiliate_link_id,
            max_results=payload.max_results,
            search_depth=payload.search_depth,
            include_raw_content=payload.include_raw_content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Không thể kết nối Tavily: {exc}",
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Tavily trả lỗi {exc.response.status_code}: {exc.response.text}",
        )
    return AffiliateProjectScanResponse(**result)


@router.get(
    "/affiliate-links",
    response_model=list[AffiliateLinkModel],
    summary="Lấy danh sách affiliate link của user hiện tại",
)
def get_affiliate_links_endpoint(
    current_user: User = Depends(get_current_user),
    service: AffiliateDataService = Depends(get_service),
) -> list[AffiliateLinkModel]:
    rows = service.get_all_affiliate_links(current_user.id)
    return [AffiliateLinkModel(**r) for r in rows]


@router.delete(
    "/affiliate-link/{affiliate_link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Xoá affiliate link và toàn bộ dữ liệu scan liên quan",
    responses={
        404: {"description": "Không tìm thấy affiliate link của user hiện tại"},
    },
)
def delete_affiliate_link_endpoint(
    affiliate_link_id: str,
    current_user: User = Depends(get_current_user),
    service: AffiliateDataService = Depends(get_service),
) -> None:
    try:
        service.delete_affiliate_link(current_user.id, affiliate_link_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get(
    "/affiliate-link-detail",
    response_model=AffiliateLinkDetailResponse,
    summary="Lấy dữ liệu đã lưu theo affiliate link của user hiện tại",
    responses={
        400: {"description": "Website/domain không hợp lệ"},
        404: {"description": "Không tìm thấy dữ liệu cho affiliate link"},
    },
)
def get_affiliate_link_detail_endpoint(
    website: str = Query(..., description="Affiliate link cần lấy dữ liệu"),
    current_user: User = Depends(get_current_user),
    service: AffiliateDataService = Depends(get_service),
) -> AffiliateLinkDetailResponse:
    try:
        result = service.get_affiliate_link_detail_by_user(current_user.id, website)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy dữ liệu cho affiliate link của user hiện tại",
        )

    return AffiliateLinkDetailResponse(**result)


@router.put(
    "/affiliate-link/{affiliate_link_id}",
    response_model=AffiliateLinkModel,
    summary="Cập nhật affiliate link",
    responses={
        404: {"description": "Không tìm thấy affiliate link của user hiện tại"},
        400: {"description": "Website/domain không hợp lệ"},
    },
)
def update_affiliate_link_endpoint(
    affiliate_link_id: str,
    payload: AffiliateLinkUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: AffiliateDataService = Depends(get_service),
) -> AffiliateLinkModel:
    try:
        row = service.update_affiliate_link(
            user_id=current_user.id,
            affiliate_link_id=affiliate_link_id,
            website=payload.website,
            name=payload.name,
            search=payload.search,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return AffiliateLinkModel(**row)
