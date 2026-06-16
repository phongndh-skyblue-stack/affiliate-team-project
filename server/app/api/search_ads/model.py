from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.utils import utc_now


class GoogleAdsSearch(Base):
    __tablename__ = "google_ads_searches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Search params
    keyword: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(100), nullable=False, default="Vietnam")
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="vi")
    device: Mapped[str] = mapped_column(String(20), nullable=False, default="desktop")

    # Result summary
    search_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="done")
    total_ads_found: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    errors: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    organic_links: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    final_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_status: Mapped[str] = mapped_column(String(20), nullable=False, default="none")

    # Proxy used (optional)
    proxy_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    proxy_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_scheduled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("affiliate_links.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    ads: Mapped[list[GoogleAdsSearchAd]] = relationship(
        "GoogleAdsSearchAd", back_populates="search", cascade="all, delete-orphan"
    )


class GoogleAdsSearchAd(Base):
    __tablename__ = "google_ads_search_ads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    search_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("google_ads_searches.id", ondelete="CASCADE"), nullable=False, index=True
    )

    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    advertiser_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    advertiser_domain: Mapped[str | None] = mapped_column(Text, nullable=True)
    advertiser_location: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    landing_page: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    search: Mapped[GoogleAdsSearch] = relationship("GoogleAdsSearch", back_populates="ads")


class GoogleAdsSearchSchedule(Base):
    __tablename__ = "google_ads_search_schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    keyword: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(100), nullable=False, default="Vietnam")
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="vi")
    device: Mapped[str] = mapped_column(String(20), nullable=False, default="desktop")
    no_proxy: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    headful: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    proxy_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    proxy_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("affiliate_links.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    batch_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    schedule_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="once", index=True)
    daily_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    notify_telegram_on_change: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    arq_job_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    search_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("google_ads_searches.id", ondelete="SET NULL"), nullable=True
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    notification_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )


class GoogleAdsSavedCompetitor(Base):
    __tablename__ = "google_ads_saved_competitors"
    __table_args__ = (
        UniqueConstraint("user_id", "keyword_key", "advertiser_key", name="uq_google_ads_saved_competitor"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    keyword: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    keyword_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    advertiser_name: Mapped[str] = mapped_column(Text, nullable=False)
    advertiser_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    advertiser_domain: Mapped[str | None] = mapped_column(Text, nullable=True)
    advertiser_location: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    landing_page: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    source_search_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("google_ads_searches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_ad_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("google_ads_search_ads.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
