from __future__ import annotations

import asyncio
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import AsyncMock, patch

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.search_ads.model import GoogleAdsSearch
from app.api.search_ads.repository import SearchAdsRepository
from app.api.search_ads.schema import (
    LandingPageInfo,
    OrganicLinkItem,
    SearchAdItem,
    SearchAdsRequest,
    SearchAdsResponse,
    SearchAdsScheduleCreate,
)
from app.core.config import SERVER_DIR
from app.shared.agents.search_ads.graph import build_ads_search_graph

# Playwright needs ProactorEventLoop on Windows to spawn subprocesses.
# Uvicorn's loop is already running when requests arrive, so we run the
# graph in a dedicated thread that owns its own ProactorEventLoop.
_playwright_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="playwright")
UPLOADS_DIR = SERVER_DIR / "uploads"
SEARCH_ADS_VIDEO_DIR = UPLOADS_DIR / "search-ads"


def _run_in_proactor(coro):
    """Run *coro* in a fresh ProactorEventLoop on Windows (SelectorEventLoop otherwise)."""
    loop = asyncio.ProactorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
        asyncio.set_event_loop(None)


class SearchAdsService:
    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        self.last_search_id: str | None = None

    async def run_search(
        self,
        user_id: str,
        payload: SearchAdsRequest,
        *,
        is_scheduled: bool = False,
    ) -> SearchAdsResponse:
        video_run_id = str(uuid.uuid4())
        video_run_dir = SEARCH_ADS_VIDEO_DIR / video_run_id if not is_scheduled else None
        if video_run_dir is not None:
            video_run_dir.mkdir(parents=True, exist_ok=True)

        # Resolve proxy config
        proxy_config: dict = {}
        proxy_name: str | None = None
        if payload.no_proxy:
            proxy_config = {"enabled": False}
        elif payload.proxy_id and self.db is not None:
            from app.api.proxy.service import ProxyService
            proxy_svc = ProxyService(self.db)
            proxy_config = proxy_svc.resolve_proxy_config(payload.proxy_id, user_id)
            proxy_name = proxy_svc.get(payload.proxy_id, user_id).name

        state: dict = {
            "keyword": payload.keyword,
            "location": payload.location,
            "language": payload.language,
            "device": payload.device,
            "proxy": proxy_config,
            "record_video_dir": str(video_run_dir) if video_run_dir is not None else None,
            "search_url": None,
            "serp_html": None,
            "serp_screenshot_path": None,
            "organic_links": [],
            "ad_candidates": [],
            "confirmed_ads": [],
            "current_ad_index": 0,
            "final_results": [],
            "final_summary": "",
            "errors": [],
            "status": "init",
        }

        graph = build_ads_search_graph()

        if payload.no_proxy:
            with patch(
                "app.shared.agents.search_ads.services.proxy.ProxyService.get_proxy_for_location",
                new=AsyncMock(return_value={"enabled": False}),
            ):
                coro = graph.ainvoke(state)
                result = await asyncio.get_running_loop().run_in_executor(
                    _playwright_pool, lambda: _run_in_proactor(coro)
                )
        else:
            coro = graph.ainvoke(state)
            result = await asyncio.get_running_loop().run_in_executor(
                _playwright_pool, lambda: _run_in_proactor(coro)
            )

        final_results: list[dict] = result.get("final_results") or []

        ads = []
        for ad in final_results:
            ads.append(SearchAdItem(
                position=ad.get("position", 0),
                title=ad.get("title"),
                snippet=ad.get("snippet"),
                display_url=ad.get("display_url"),
                target_url=ad.get("target_url"),
                advertiser_name=ad.get("advertiser_name"),
                advertiser_domain=ad.get("advertiser_domain"),
                advertiser_location=ad.get("advertiser_location"),
                confidence=ad.get("confidence", 0.0),
                source=ad.get("source"),
                landing_page=_parse_landing(ad.get("landing_page")),
            ))

        organic_links = [
            OrganicLinkItem(title=ol.get("title"), url=ol.get("url"))
            for ol in (result.get("organic_links") or [])
        ]

        response = SearchAdsResponse(
            keyword=payload.keyword,
            search_url=result.get("search_url"),
            status=result.get("status", "done"),
            total_ads_found=len(ads),
            ads=ads,
            errors=result.get("errors") or [],
            organic_links=organic_links,
            final_summary=result.get("final_summary"),
        )

        video_path = _find_recorded_video_path(video_run_dir)
        video_status = "available" if video_path else "none"

        if self.db is not None:
            repo = SearchAdsRepository(self.db)
            saved_search = repo.save_search(
                user_id=user_id,
                response=response,
                location=payload.location,
                language=payload.language,
                device=payload.device,
                proxy_id=payload.proxy_id if not payload.no_proxy else None,
                proxy_name=proxy_name,
                is_scheduled=is_scheduled,
                video_path=video_path,
                video_status=video_status,
            )
            self.last_search_id = saved_search.id
            response.id = saved_search.id
            response.video_url = _video_url(video_path)
            response.video_status = video_status
        else:
            response.video_url = _video_url(video_path)
            response.video_status = video_status

        return response

    def list_by_user_id(self, user_id: str, *, is_scheduled: bool = False) -> list[GoogleAdsSearch]:
        if self.db is None:
            return []
        return SearchAdsRepository(self.db).list_by_user_id(user_id, is_scheduled=is_scheduled)

    async def create_schedules(self, user_id: str, payload: SearchAdsScheduleCreate):
        if self.db is None:
            return []

        proxy_name: str | None = None
        proxy_id = None if payload.no_proxy else payload.proxy_id
        if not payload.no_proxy:
            if not payload.proxy_id:
                raise HTTPException(status_code=400, detail="proxy_id is required when no_proxy is false")
            from app.api.proxy.service import ProxyService

            proxy = ProxyService(self.db).get(payload.proxy_id, user_id)
            proxy_name = proxy.name

        from app.api.search_ads.arq_client import enqueue_search_ads_schedule

        repo = SearchAdsRepository(self.db)
        batch_id = str(uuid.uuid4())
        schedules = []
        for run_at in payload.run_at:
            normalized_run_at = _normalize_run_at(run_at)
            if normalized_run_at <= datetime.now(UTC):
                raise HTTPException(status_code=400, detail="run_at must be in the future")
            schedule = repo.create_schedule(
                user_id=user_id,
                keyword=payload.keyword,
                location=payload.location,
                language=payload.language,
                device=payload.device,
                no_proxy=payload.no_proxy,
                headful=payload.headful,
                proxy_id=proxy_id,
                proxy_name=proxy_name,
                batch_id=batch_id,
                run_at=normalized_run_at,
            )
            try:
                job = await enqueue_search_ads_schedule(schedule.id, normalized_run_at)
            except Exception as exc:
                self.db.delete(schedule)
                self.db.commit()
                raise HTTPException(status_code=503, detail=f"Cannot enqueue schedule to ARQ: {exc}") from exc
            schedule.arq_job_id = job.job_id if job else None
            schedule.status = "enqueued"
            self.db.commit()
            self.db.refresh(schedule)
            schedules.append(schedule)
        return schedules

    def list_schedules_by_user_id(self, user_id: str):
        if self.db is None:
            return []
        return SearchAdsRepository(self.db).list_schedules_by_user_id(user_id)

    def cancel_schedule(self, schedule_id: str, user_id: str) -> None:
        if self.db is None:
            return
        schedule = SearchAdsRepository(self.db).get_schedule(schedule_id, user_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        if schedule.status in {"done", "running"}:
            raise HTTPException(status_code=400, detail=f"Cannot cancel schedule with status {schedule.status}")
        schedule.status = "cancelled"
        self.db.commit()

    def delete_video(self, search_id: str, user_id: str) -> None:
        if self.db is None:
            return
        repo = SearchAdsRepository(self.db)
        search = repo.get_search(search_id, user_id)
        if not search:
            raise HTTPException(status_code=404, detail="Search not found")
        if search.video_status == "deleted":
            return
        if search.video_path:
            path = _resolve_upload_path(search.video_path)
            if path.exists() and path.is_file():
                path.unlink()
            _cleanup_empty_parents(path.parent, stop_at=SEARCH_ADS_VIDEO_DIR)
        repo.mark_video_deleted(search)


def _parse_landing(lp: dict | None) -> LandingPageInfo | None:
    if not lp:
        return None
    return LandingPageInfo(
        original_url=lp.get("original_url"),
        final_url=lp.get("final_url"),
        domain=lp.get("domain"),
        redirect_chain=lp.get("redirect_chain") or [],
        status=lp.get("status"),
        error=lp.get("error"),
        final_status_code=lp.get("final_status_code"),
    )


def _normalize_run_at(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=ZoneInfo("Asia/Ho_Chi_Minh"))
    return value.astimezone(UTC)


def _find_recorded_video_path(run_dir: Path | None) -> str | None:
    if run_dir is None or not run_dir.exists():
        return None
    videos = sorted(run_dir.rglob("*.webm"), key=lambda item: item.stat().st_mtime, reverse=True)
    if not videos:
        return None
    return videos[0].relative_to(SERVER_DIR).as_posix()


def _video_url(video_path: str | None) -> str | None:
    if not video_path:
        return None
    return "/" + video_path.replace("\\", "/").lstrip("/")


def _resolve_upload_path(relative_path: str) -> Path:
    path = (SERVER_DIR / relative_path).resolve()
    uploads_root = UPLOADS_DIR.resolve()
    if uploads_root not in path.parents:
        raise HTTPException(status_code=400, detail="Invalid video path")
    return path


def _cleanup_empty_parents(path: Path, *, stop_at: Path) -> None:
    stop_at = stop_at.resolve()
    current = path.resolve()
    while current != stop_at and stop_at in current.parents:
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent
