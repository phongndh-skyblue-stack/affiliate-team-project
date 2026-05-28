from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.utils import utc_now


class ManualCompetitorSearch(Base):
    __tablename__ = "manual_competitor_searches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    keyword: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    google_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    location: Mapped[str] = mapped_column(String(100), nullable=False, default="Vietnam")
    hl: Mapped[str] = mapped_column(String(10), nullable=False, default="vi")
    gl: Mapped[str] = mapped_column(String(10), nullable=False, default="vn")
    num: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    no_cache: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    total_ads_found: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    top_ads_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bottom_ads_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    ads: Mapped[list[ManualCompetitorSearchAd]] = relationship(
        "ManualCompetitorSearchAd", back_populates="search", cascade="all, delete-orphan"
    )


class ManualCompetitorSearchAd(Base):
    __tablename__ = "manual_competitor_search_ads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    search_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("manual_competitor_searches.id", ondelete="CASCADE"), nullable=False, index=True
    )

    position: Mapped[str] = mapped_column(String(50), nullable=False)
    advertiser: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    snippet: Mapped[str] = mapped_column(Text, nullable=False, default="")
    link: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sitelinks: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    search: Mapped[ManualCompetitorSearch] = relationship(
        "ManualCompetitorSearch", back_populates="ads"
    )