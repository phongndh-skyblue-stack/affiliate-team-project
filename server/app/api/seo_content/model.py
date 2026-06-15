from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.shared.utils import utc_now


class SeoContent(Base):
    __tablename__ = "seo_contents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    final_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    seo_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    headlines: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    descriptions: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    keywords: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    
    body_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_persona: Mapped[str | None] = mapped_column(Text, nullable=True)
    seo_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
