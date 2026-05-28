from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.utils import utc_now


class AffiliateLink(Base):
    __tablename__ = "affiliate_links"
    __table_args__ = (
        UniqueConstraint("user_id", "affiliate_url", name="uq_affiliate_links_user_url"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    affiliate_url: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    traffic_scans: Mapped[list[AffiliateLinkTrafficScan]] = relationship(
        "AffiliateLinkTrafficScan",
        back_populates="affiliate_link",
        cascade="all, delete-orphan",
    )
    project_data_scans: Mapped[list[AffiliateLinkProjectDataScan]] = relationship(
        "AffiliateLinkProjectDataScan",
        back_populates="affiliate_link",
        cascade="all, delete-orphan",
    )


class AffiliateLinkTrafficScan(Base):
    __tablename__ = "affiliate_link_traffic_scans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    affiliate_link_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("affiliate_links.id", ondelete="CASCADE"), nullable=False, index=True
    )

    found: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    monthly_visits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    period_month: Mapped[str] = mapped_column(String(7), nullable=False, default="")
    traffic_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    affiliate_link: Mapped[AffiliateLink] = relationship("AffiliateLink", back_populates="traffic_scans")


class AffiliateLinkProjectDataScan(Base):
    __tablename__ = "affiliate_link_project_data_scans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    affiliate_link_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("affiliate_links.id", ondelete="CASCADE"), nullable=False, index=True
    )

    query: Mapped[str] = mapped_column(Text, nullable=False, default="")
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    project_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    sale_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    top_countries: Mapped[list | None] = mapped_column(JSON, nullable=True)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    results: Mapped[list | None] = mapped_column(JSON, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    affiliate_link: Mapped[AffiliateLink] = relationship("AffiliateLink", back_populates="project_data_scans")
