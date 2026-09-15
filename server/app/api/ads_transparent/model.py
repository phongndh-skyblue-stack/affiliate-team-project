from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.utils import utc_now


class AdTransparencySearch(Base):
    __tablename__ = "ad_transparency_searches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Search parameters
    text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    advertiser_id_query: Mapped[str | None] = mapped_column(String(100), nullable=True)
    platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    creative_format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    region: Mapped[str | None] = mapped_column(String(20), nullable=True)
    political_ads: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    num: Mapped[int] = mapped_column(Integer, nullable=False, default=40)
    next_page_token_input: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("affiliate_links.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Response metadata
    total_results: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_page_token_output: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    creatives: Mapped[list[AdCreative]] = relationship(
        "AdCreative", back_populates="search", cascade="all, delete-orphan"
    )


class AdCreative(Base):
    __tablename__ = "ad_creatives"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    search_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ad_transparency_searches.id", ondelete="CASCADE"), nullable=False, index=True
    )

    advertiser_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    advertiser: Mapped[str] = mapped_column(String(255), nullable=False)
    ad_creative_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    format: Mapped[str] = mapped_column(String(50), nullable=False)
    target_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str | None] = mapped_column(Text, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_days_shown: Mapped[int | None] = mapped_column(Integer, nullable=True)
    first_shown: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_shown: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    serpapi_details_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    details: Mapped[list[AdCreativeDetail]] = relationship(
        "AdCreativeDetail", back_populates="creative"
    )

    search: Mapped[AdTransparencySearch] = relationship("AdTransparencySearch", back_populates="creatives")


class AdCreativeDetail(Base):
    __tablename__ = "ad_creative_details"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Optional FK to AdCreative (nullable — can be linked later or looked up by google_creative_id)
    ad_creative_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ad_creatives.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # From search_parameters
    advertiser_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    google_creative_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # From search_information (scalar fields)
    format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_shown: Mapped[int | None] = mapped_column(Integer, nullable=True)
    region_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    more_ads_by_advertiser: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON arrays
    regions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    ad_creatives: Mapped[list | None] = mapped_column(JSON, nullable=True)

    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    creative: Mapped[AdCreative | None] = relationship("AdCreative", back_populates="details")
