from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.search_ads.model import (
    GoogleAdsSavedCompetitor,
    GoogleAdsSearch,
    GoogleAdsSearchAd,
    GoogleAdsSearchSchedule,
)
from app.api.search_ads.schema import SearchAdsCompetitorCreate, SearchAdsResponse


class SearchAdsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def save_search(
        self,
        user_id: str,
        response: SearchAdsResponse,
        location: str,
        language: str,
        device: str,
        proxy_id: str | None = None,
        proxy_name: str | None = None,
        is_scheduled: bool = False,
        project_id: str | None = None,
        project_name: str | None = None,
        video_path: str | None = None,
        video_status: str = "none",
    ) -> GoogleAdsSearch:
        search = GoogleAdsSearch(
            user_id=user_id,
            keyword=response.keyword,
            location=location,
            language=language,
            device=device,
            search_url=response.search_url,
            status=response.status,
            total_ads_found=response.total_ads_found,
            errors=response.errors,
            organic_links=[ol.model_dump() for ol in response.organic_links],
            final_summary=response.final_summary,
            video_path=video_path,
            video_status=video_status,
            proxy_id=proxy_id,
            proxy_name=proxy_name,
            is_scheduled=is_scheduled,
            project_id=project_id,
            project_name=project_name,
        )
        self.db.add(search)
        self.db.flush()

        for ad in response.ads:
            self.db.add(
                GoogleAdsSearchAd(
                    search_id=search.id,
                    position=ad.position,
                    title=ad.title,
                    snippet=ad.snippet,
                    display_url=ad.display_url,
                    target_url=ad.target_url,
                    advertiser_name=ad.advertiser_name,
                    advertiser_domain=ad.advertiser_domain,
                    advertiser_location=ad.advertiser_location,
                    confidence=ad.confidence,
                    source=ad.source,
                    landing_page=ad.landing_page.model_dump() if ad.landing_page else None,
                )
            )

        self.db.commit()
        self.db.refresh(search)
        return search

    def list_by_user_id(self, user_id: str, *, source: str = "manual") -> list[GoogleAdsSearch]:
        scheduled_search_ids = (
            select(GoogleAdsSearchSchedule.search_id)
            .where(
                GoogleAdsSearchSchedule.user_id == user_id,
                GoogleAdsSearchSchedule.search_id.is_not(None),
            )
        )
        stmt = (
            select(GoogleAdsSearch)
            .options(selectinload(GoogleAdsSearch.ads))
            .order_by(GoogleAdsSearch.created_at.desc())
        )
        if source == "all":
            stmt = stmt.where(GoogleAdsSearch.user_id == user_id)
        elif source == "scheduled":
            stmt = stmt.where(
                GoogleAdsSearch.user_id == user_id,
                or_(
                    GoogleAdsSearch.is_scheduled.is_(True),
                    GoogleAdsSearch.id.in_(scheduled_search_ids),
                ),
            )
        else:
            stmt = stmt.where(
                GoogleAdsSearch.user_id == user_id,
                GoogleAdsSearch.is_scheduled.is_(False),
                GoogleAdsSearch.id.not_in(scheduled_search_ids),
            )
        return list(self.db.scalars(stmt))

    def create_schedule(
        self,
        *,
        user_id: str,
        keyword: str,
        location: str,
        language: str,
        device: str,
        no_proxy: bool,
        headful: bool,
        proxy_id: str | None,
        proxy_name: str | None,
        project_id: str | None,
        project_name: str | None,
        batch_id: str | None,
        run_at,
        schedule_mode: str = "once",
        daily_time: str | None = None,
        notify_telegram_on_change: bool = False,
    ) -> GoogleAdsSearchSchedule:
        schedule = GoogleAdsSearchSchedule(
            user_id=user_id,
            keyword=keyword,
            location=location,
            language=language,
            device=device,
            no_proxy=no_proxy,
            headful=headful,
            proxy_id=proxy_id,
            proxy_name=proxy_name,
            project_id=project_id,
            project_name=project_name,
            batch_id=batch_id,
            schedule_mode=schedule_mode,
            daily_time=daily_time,
            notify_telegram_on_change=notify_telegram_on_change,
            run_at=run_at,
            status="pending",
        )
        self.db.add(schedule)
        self.db.commit()
        self.db.refresh(schedule)
        return schedule

    def list_schedules_by_user_id(self, user_id: str) -> list[GoogleAdsSearchSchedule]:
        stmt = (
            select(GoogleAdsSearchSchedule)
            .where(GoogleAdsSearchSchedule.user_id == user_id)
            .order_by(GoogleAdsSearchSchedule.run_at.desc())
        )
        return list(self.db.scalars(stmt))

    def get_schedule(self, schedule_id: str, user_id: str | None = None) -> GoogleAdsSearchSchedule | None:
        stmt = select(GoogleAdsSearchSchedule).where(GoogleAdsSearchSchedule.id == schedule_id)
        if user_id is not None:
            stmt = stmt.where(GoogleAdsSearchSchedule.user_id == user_id)
        return self.db.scalar(stmt)

    def get_search(self, search_id: str, user_id: str | None = None) -> GoogleAdsSearch | None:
        stmt = select(GoogleAdsSearch).where(GoogleAdsSearch.id == search_id)
        if user_id is not None:
            stmt = stmt.where(GoogleAdsSearch.user_id == user_id)
        return self.db.scalar(stmt)

    def mark_video_deleted(self, search: GoogleAdsSearch) -> None:
        search.video_path = None
        search.video_status = "deleted"
        self.db.commit()
        self.db.refresh(search)

    def delete_search(self, search: GoogleAdsSearch) -> None:
        self.db.delete(search)
        self.db.commit()

    def save_competitor(
        self,
        *,
        user_id: str,
        payload: SearchAdsCompetitorCreate,
        keyword_key: str,
        advertiser_name: str,
        advertiser_key: str,
    ) -> GoogleAdsSavedCompetitor:
        competitor = GoogleAdsSavedCompetitor(
            user_id=user_id,
            keyword=payload.keyword.strip(),
            keyword_key=keyword_key,
            advertiser_name=advertiser_name,
            advertiser_key=advertiser_key,
            advertiser_domain=payload.advertiser_domain,
            advertiser_location=payload.advertiser_location,
            title=payload.title,
            snippet=payload.snippet,
            display_url=payload.display_url,
            target_url=payload.target_url,
            position=payload.position,
            confidence=payload.confidence,
            landing_page=payload.landing_page.model_dump() if payload.landing_page else None,
            source_search_id=payload.source_search_id,
            source_ad_id=payload.source_ad_id,
        )
        self.db.add(competitor)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise
        self.db.refresh(competitor)
        return competitor

    def list_competitors_by_user_id(self, user_id: str) -> list[GoogleAdsSavedCompetitor]:
        stmt = (
            select(GoogleAdsSavedCompetitor)
            .where(GoogleAdsSavedCompetitor.user_id == user_id)
            .order_by(GoogleAdsSavedCompetitor.created_at.desc())
        )
        return list(self.db.scalars(stmt))

    def get_competitor(self, competitor_id: str, user_id: str) -> GoogleAdsSavedCompetitor | None:
        return self.db.scalar(
            select(GoogleAdsSavedCompetitor).where(
                GoogleAdsSavedCompetitor.id == competitor_id,
                GoogleAdsSavedCompetitor.user_id == user_id,
            )
        )

    def delete_competitor(self, competitor: GoogleAdsSavedCompetitor) -> None:
        self.db.delete(competitor)
        self.db.commit()
