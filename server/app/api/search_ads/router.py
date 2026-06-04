from __future__ import annotations

from datetime import UTC

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.search_ads.schema import (
    OrganicLinkItem,
    SearchAdsHistoryItem,
    SearchAdsHistoryResponse,
    SearchAdsRequest,
    SearchAdsResponse,
    SearchAdsScheduleCreate,
    SearchAdsScheduleItem,
    SearchAdsScheduleResponse,
)
from app.api.search_ads.service import SearchAdsService
from app.core.database import get_db
from app.shared.deps import get_current_user

router = APIRouter(
    prefix="/search-ads",
    tags=["Search Ads"],
)


def get_service(db: Session = Depends(get_db)) -> SearchAdsService:
    return SearchAdsService(db)


@router.post(
    "/run",
    response_model=SearchAdsResponse,
    summary="Tìm quảng cáo Google và thông tin nhà quảng cáo theo từ khóa",
)
async def run_search_ads(
    payload: SearchAdsRequest,
    current_user: User = Depends(get_current_user),
    service: SearchAdsService = Depends(get_service),
) -> SearchAdsResponse:
    return await service.run_search(user_id=current_user.id, payload=payload)


@router.get(
    "/history",
    response_model=SearchAdsHistoryResponse,
    summary="Lấy lịch sử tìm quảng cáo Google Ads của user",
)
def get_search_ads_history(
    current_user: User = Depends(get_current_user),
    service: SearchAdsService = Depends(get_service),
) -> SearchAdsHistoryResponse:
    searches = service.list_by_user_id(current_user.id)
    items = [_history_item(search) for search in searches]
    return SearchAdsHistoryResponse(total=len(items), items=items)


@router.get(
    "/scheduled-results",
    response_model=SearchAdsHistoryResponse,
    summary="Lấy kết quả quét quảng cáo Google Ads từ lịch đặt",
)
def get_scheduled_search_ads_results(
    current_user: User = Depends(get_current_user),
    service: SearchAdsService = Depends(get_service),
) -> SearchAdsHistoryResponse:
    searches = service.list_by_user_id(current_user.id, is_scheduled=True)
    items = [_history_item(search) for search in searches]
    return SearchAdsHistoryResponse(total=len(items), items=items)


@router.delete(
    "/history/{search_id}/video",
    status_code=204,
    response_model=None,
    summary="Xóa video ghi lại quá trình tìm quảng cáo",
)
def delete_search_ads_video(
    search_id: str,
    current_user: User = Depends(get_current_user),
    service: SearchAdsService = Depends(get_service),
) -> None:
    service.delete_video(search_id, current_user.id)


@router.post(
    "/schedules",
    response_model=SearchAdsScheduleResponse,
    summary="Đặt lịch chạy tìm quảng cáo Google Ads theo các mốc thời gian",
)
async def create_search_ads_schedules(
    payload: SearchAdsScheduleCreate,
    current_user: User = Depends(get_current_user),
    service: SearchAdsService = Depends(get_service),
) -> SearchAdsScheduleResponse:
    schedules = await service.create_schedules(current_user.id, payload)
    items = [_schedule_item(schedule) for schedule in schedules]
    return SearchAdsScheduleResponse(total=len(items), items=items)


@router.get(
    "/schedules",
    response_model=SearchAdsScheduleResponse,
    summary="Danh sách lịch chạy tìm quảng cáo Google Ads của user",
)
def get_search_ads_schedules(
    current_user: User = Depends(get_current_user),
    service: SearchAdsService = Depends(get_service),
) -> SearchAdsScheduleResponse:
    schedules = service.list_schedules_by_user_id(current_user.id)
    items = [_schedule_item(schedule) for schedule in schedules]
    return SearchAdsScheduleResponse(total=len(items), items=items)


@router.delete(
    "/schedules/{schedule_id}",
    status_code=204,
    response_model=None,
    summary="Hủy một lịch chạy tìm quảng cáo Google Ads",
)
def cancel_search_ads_schedule(
    schedule_id: str,
    current_user: User = Depends(get_current_user),
    service: SearchAdsService = Depends(get_service),
) -> None:
    service.cancel_schedule(schedule_id, current_user.id)


def _schedule_item(schedule) -> SearchAdsScheduleItem:
    return SearchAdsScheduleItem(
        id=schedule.id,
        user_id=schedule.user_id,
        keyword=schedule.keyword,
        location=schedule.location,
        language=schedule.language,
        device=schedule.device,
        no_proxy=schedule.no_proxy,
        headful=schedule.headful,
        proxy_id=schedule.proxy_id,
        proxy_name=schedule.proxy_name,
        batch_id=schedule.batch_id,
        run_at=_utc_iso(schedule.run_at),
        status=schedule.status,
        arq_job_id=schedule.arq_job_id,
        search_id=schedule.search_id,
        error=schedule.error,
        created_at=_utc_iso(schedule.created_at),
        updated_at=_utc_iso(schedule.updated_at),
    )


def _history_item(search) -> SearchAdsHistoryItem:
    return SearchAdsHistoryItem(
        id=search.id,
        user_id=search.user_id,
        keyword=search.keyword,
        location=search.location,
        language=search.language,
        device=search.device,
        search_url=search.search_url,
        status=search.status,
        total_ads_found=search.total_ads_found,
        errors=search.errors or [],
        organic_links=[
            OrganicLinkItem(title=ol.get("title"), url=ol.get("url"))
            for ol in (search.organic_links or [])
        ],
        final_summary=search.final_summary,
        proxy_name=search.proxy_name,
        is_scheduled=search.is_scheduled,
        video_url=_video_url(search.video_path),
        video_status=search.video_status or "none",
        ads=[
            {
                "position": ad.position,
                "title": ad.title,
                "snippet": ad.snippet,
                "displayUrl": ad.display_url,
                "targetUrl": ad.target_url,
                "advertiserName": ad.advertiser_name,
                "advertiserDomain": ad.advertiser_domain,
                "advertiserLocation": ad.advertiser_location,
                "confidence": ad.confidence,
                "source": ad.source,
                "landingPage": ad.landing_page,
            }
            for ad in search.ads
        ],
        created_at=_utc_iso(search.created_at),
    )


def _utc_iso(value) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _video_url(video_path: str | None) -> str | None:
    if not video_path:
        return None
    return "/" + video_path.replace("\\", "/").lstrip("/")
