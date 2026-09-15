from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.utils import utc_now


class KeywordPlannerJob(Base):
    """Stores each keyword-planner scan request (seed keywords or URL)."""

    __tablename__ = "keyword_planner_jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # "keywords" | "url"
    input_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # For keyword-based scans
    keywords: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # For URL-based scans
    page_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    use_entire_site: Mapped[bool] = mapped_column(Integer, nullable=False, default=1)

    # Planner settings
    ads_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)  # Google Ads customer ID used
    language_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    location_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    result_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=500)

    # Job lifecycle
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", index=True
    )  # pending | done | error
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    results: Mapped[list[KeywordPlannerResult]] = relationship(
        "KeywordPlannerResult",
        back_populates="job",
        cascade="all, delete-orphan",
    )


class KeywordPlannerResult(Base):
    """Stores individual keyword idea rows returned by a KeywordPlannerJob."""

    __tablename__ = "keyword_planner_results"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    job_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("keyword_planner_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    keyword: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    avg_monthly_searches: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    competition: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    competition_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    low_top_page_bid: Mapped[float | None] = mapped_column(Float, nullable=True)
    high_top_page_bid: Mapped[float | None] = mapped_column(Float, nullable=True)
    monthly_searches: Mapped[list | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    job: Mapped[KeywordPlannerJob] = relationship(
        "KeywordPlannerJob", back_populates="results"
    )


class KeywordCandidateProject(Base):
    """A URL-optional project opportunity saved from keyword research."""

    __tablename__ = "keyword_candidate_projects"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    affiliate_project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("affiliate_links.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_job_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("keyword_planner_jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_ads_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    language_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    location_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    website_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    items: Mapped[list["KeywordCandidateItem"]] = relationship(
        "KeywordCandidateItem",
        back_populates="candidate",
        cascade="all, delete-orphan",
        order_by="KeywordCandidateItem.opportunity_score.desc()",
    )


class KeywordCandidateItem(Base):
    """Durable keyword metric and classification snapshot for a candidate."""

    __tablename__ = "keyword_candidate_items"
    __table_args__ = (
        UniqueConstraint("candidate_id", "normalized_keyword", name="uq_candidate_keyword"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    candidate_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("keyword_candidate_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_result_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("keyword_planner_results.id", ondelete="SET NULL"), nullable=True
    )
    keyword: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_keyword: Mapped[str] = mapped_column(String(500), nullable=False)
    avg_monthly_searches: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    competition: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    competition_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    low_top_page_bid: Mapped[float | None] = mapped_column(Float, nullable=True)
    high_top_page_bid: Mapped[float | None] = mapped_column(Float, nullable=True)
    monthly_searches: Mapped[list | None] = mapped_column(JSON, nullable=True)
    inferred_intent: Mapped[str] = mapped_column(String(30), nullable=False, default="unknown")
    manual_intent: Mapped[str | None] = mapped_column(String(30), nullable=True)
    opportunity_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    opportunity_tier: Mapped[str] = mapped_column(String(20), nullable=False, default="low")
    score_explanation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    candidate: Mapped[KeywordCandidateProject] = relationship(
        "KeywordCandidateProject", back_populates="items"
    )


# ===========================================================================
# Mail Delegation Models
# ===========================================================================


class DelegatedMail(Base):
    """One row per (email, user_id) pair — the list of mails being managed."""

    __tablename__ = "delegated_mails"
    __table_args__ = (UniqueConstraint("email", "user_id", name="uq_delegated_mail_email_user"),)

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    author_gmail: Mapped["AuthorGmail | None"] = relationship(
        "AuthorGmail", back_populates="delegated_mail", uselist=False, cascade="all, delete-orphan"
    )
    accounts: Mapped[list["AdsAccount"]] = relationship(
        "AdsAccount", back_populates="delegated_mail", cascade="all, delete-orphan"
    )


class AuthorGmail(Base):
    """OAuth2 token storage — 1:1 with DelegatedMail."""

    __tablename__ = "author_gmails"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    mail_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("delegated_mails.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    refresh_token: Mapped[str | None] = mapped_column(String(512), nullable=True)
    access_token: Mapped[str | None] = mapped_column(String(512), nullable=True)
    state: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    code_verifier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=utc_now
    )
    delegated_mail: Mapped["DelegatedMail"] = relationship(
        "DelegatedMail", back_populates="author_gmail"
    )

    @property
    def is_delegated(self) -> bool:
        return bool(self.refresh_token and self.refresh_token.strip())


class AdsAccount(Base):
    """A Google Ads account imported after successful delegation."""

    __tablename__ = "ads_accounts"
    __table_args__ = (UniqueConstraint("mail_id", "ads_id", name="uq_ads_account_mail_ads"),)

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    mail_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("delegated_mails.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ads_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    ads_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ads_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    account_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    manager_account_ads_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    manager_account_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ads_accounts.id", ondelete="SET NULL"), nullable=True
    )
    currency_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    budget_paid: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget_used: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget_adjustment: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    delegated_mail: Mapped["DelegatedMail"] = relationship(
        "DelegatedMail", back_populates="accounts"
    )
    sub_accounts: Mapped[list["AdsAccount"]] = relationship(
        "AdsAccount",
        foreign_keys="AdsAccount.manager_account_id",
        back_populates="parent_account",
    )
    parent_account: Mapped["AdsAccount | None"] = relationship(
        "AdsAccount",
        foreign_keys="AdsAccount.manager_account_id",
        back_populates="sub_accounts",
        remote_side="AdsAccount.id",
    )
