from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.keyword_planner.model import (
    AdsAccount,
    AuthorGmail,
    DelegatedMail,
    KeywordCandidateItem,
    KeywordCandidateProject,
    KeywordPlannerJob,
    KeywordPlannerResult,
)


class KeywordPlannerRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Jobs
    # ------------------------------------------------------------------

    def create_job(
        self,
        *,
        user_id: Optional[str],
        ads_id: Optional[str],
        input_type: str,
        keywords: Optional[list[str]],
        page_url: Optional[str],
        use_entire_site: bool,
        language_id: int,
        location_ids: Optional[list[int]],
        result_limit: int,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> KeywordPlannerJob:
        job = KeywordPlannerJob(
            user_id=user_id,
            ads_id=ads_id,
            input_type=input_type,
            keywords=keywords,
            page_url=page_url,
            use_entire_site=1 if use_entire_site else 0,
            language_id=language_id,
            location_ids=location_ids,
            result_limit=result_limit,
            status="pending",
            project_id=project_id,
            project_name=project_name,
        )
        self.db.add(job)
        self.db.flush()
        return job

    def mark_job_done(self, job: KeywordPlannerJob) -> None:
        job.status = "done"
        self.db.flush()

    def mark_job_error(self, job: KeywordPlannerJob, message: str) -> None:
        job.status = "error"
        job.error_message = message[:2000]
        self.db.flush()

    def get_job_by_id(self, job_id: str) -> Optional[KeywordPlannerJob]:
        return self.db.get(KeywordPlannerJob, job_id)

    def list_jobs(
        self,
        user_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[KeywordPlannerJob], int]:
        query = self.db.query(KeywordPlannerJob)
        if user_id:
            query = query.filter(KeywordPlannerJob.user_id == user_id)
        total = query.count()
        jobs = (
            query.order_by(KeywordPlannerJob.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return jobs, total

    # ------------------------------------------------------------------
    # Results
    # ------------------------------------------------------------------

    def bulk_create_results(
        self, job_id: str, ideas: list[dict]
    ) -> list[KeywordPlannerResult]:
        rows = [
            KeywordPlannerResult(
                job_id=job_id,
                keyword=idea["keyword"],
                avg_monthly_searches=idea.get("avg_monthly_searches", 0),
                competition=idea.get("competition", ""),
                competition_index=idea.get("competition_index"),
                low_top_page_bid=idea.get("low_top_page_bid"),
                high_top_page_bid=idea.get("high_top_page_bid"),
                monthly_searches=idea.get("monthly_searches", []),
            )
            for idea in ideas
        ]
        self.db.add_all(rows)
        self.db.flush()
        return rows

    def get_results_by_job_id(self, job_id: str) -> list[KeywordPlannerResult]:
        return (
            self.db.query(KeywordPlannerResult)
            .filter(KeywordPlannerResult.job_id == job_id)
            .order_by(KeywordPlannerResult.avg_monthly_searches.desc())
            .all()
        )


class KeywordCandidateRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_candidate(
        self,
        *,
        user_id: str,
        name: str,
        description: Optional[str],
        status: str,
        notes: Optional[str],
        tags: list[str],
        language_id: int,
        location_ids: list[int],
        source_ads_id: Optional[str],
        source_job_id: Optional[str],
        website_url: Optional[str],
    ) -> KeywordCandidateProject:
        candidate = KeywordCandidateProject(
            user_id=user_id,
            name=name,
            description=description,
            status=status,
            notes=notes,
            tags=tags,
            language_id=language_id,
            location_ids=location_ids,
            source_ads_id=source_ads_id,
            source_job_id=source_job_id,
            website_url=website_url,
        )
        self.db.add(candidate)
        self.db.flush()
        return candidate

    def list_candidates(
        self,
        user_id: str,
        *,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[KeywordCandidateProject], int]:
        query = self.db.query(KeywordCandidateProject).filter(
            KeywordCandidateProject.user_id == user_id
        )
        if status:
            query = query.filter(KeywordCandidateProject.status == status)
        total = query.count()
        items = (
            query.options(selectinload(KeywordCandidateProject.items))
            .order_by(KeywordCandidateProject.updated_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return items, total

    def get_candidate_for_user(
        self, candidate_id: str, user_id: str
    ) -> Optional[KeywordCandidateProject]:
        stmt = (
            select(KeywordCandidateProject)
            .where(
                KeywordCandidateProject.id == candidate_id,
                KeywordCandidateProject.user_id == user_id,
            )
            .options(selectinload(KeywordCandidateProject.items))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def replace_candidate_items(
        self, candidate: KeywordCandidateProject, items: list[dict]
    ) -> None:
        candidate.items.clear()
        seen: set[str] = set()
        for item in items:
            keyword = str(item.get("keyword") or "").strip()
            normalized = " ".join(keyword.casefold().split())
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            candidate.items.append(
                KeywordCandidateItem(
                    source_result_id=item.get("source_result_id"),
                    keyword=keyword,
                    normalized_keyword=normalized,
                    avg_monthly_searches=item.get("avg_monthly_searches", 0),
                    competition=item.get("competition", ""),
                    competition_index=item.get("competition_index"),
                    low_top_page_bid=item.get("low_top_page_bid"),
                    high_top_page_bid=item.get("high_top_page_bid"),
                    monthly_searches=item.get("monthly_searches", []),
                    inferred_intent=item.get("inferred_intent", "unknown"),
                    manual_intent=item.get("manual_intent"),
                    opportunity_score=item.get("opportunity_score", 0),
                    opportunity_tier=item.get("opportunity_tier", "low"),
                    score_explanation=item.get("score_explanation", ""),
                    notes=item.get("notes"),
                    tags=item.get("tags", []),
                )
            )
        self.db.flush()

    def delete_candidate(self, candidate: KeywordCandidateProject) -> None:
        self.db.delete(candidate)
        self.db.flush()


# ---------------------------------------------------------------------------
# Mail Delegation
# ---------------------------------------------------------------------------


class DelegatedMailRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, mail_id: str) -> Optional[DelegatedMail]:
        return self.db.get(DelegatedMail, mail_id)

    def get_by_email_and_user(self, email: str, user_id: str) -> Optional[DelegatedMail]:
        stmt = select(DelegatedMail).where(
            DelegatedMail.email == email,
            DelegatedMail.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_user(
        self, user_id: str, skip: int = 0, limit: int = 50
    ) -> tuple[list[DelegatedMail], int]:
        base = (
            select(DelegatedMail)
            .where(DelegatedMail.user_id == user_id)
            .options(
                selectinload(DelegatedMail.author_gmail),
                selectinload(DelegatedMail.accounts),
            )
        )
        total = self.db.scalar(
            select(func.count()).where(DelegatedMail.user_id == user_id)
        ) or 0
        items = (
            self.db.execute(base.order_by(DelegatedMail.created_at.desc()).offset(skip).limit(limit))
            .scalars()
            .all()
        )
        return list(items), total

    def create(self, email: str, user_id: str) -> DelegatedMail:
        mail = DelegatedMail(email=email, user_id=user_id)
        self.db.add(mail)
        self.db.flush()
        return mail

    def delete(self, mail: DelegatedMail) -> None:
        self.db.delete(mail)
        self.db.flush()


class AuthorGmailRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_mail_id(self, mail_id: str) -> Optional[AuthorGmail]:
        stmt = select(AuthorGmail).where(AuthorGmail.mail_id == mail_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_state(self, state: str) -> Optional[AuthorGmail]:
        stmt = select(AuthorGmail).where(AuthorGmail.state == state)
        return self.db.execute(stmt).scalar_one_or_none()

    def create(
        self,
        mail_id: str,
        created_by: str,
        *,
        state: str,
        code_verifier: str,
        expires_in: datetime,
    ) -> AuthorGmail:
        author = AuthorGmail(
            mail_id=mail_id,
            created_by=created_by,
            state=state,
            code_verifier=code_verifier,
            expires_in=expires_in,
        )
        self.db.add(author)
        self.db.flush()
        return author

    def update_state(
        self,
        author: AuthorGmail,
        *,
        state: str,
        code_verifier: str,
        expires_in: datetime,
        updated_by: str,
    ) -> None:
        author.state = state
        author.code_verifier = code_verifier
        author.expires_in = expires_in
        author.updated_by = updated_by
        self.db.flush()

    def save_tokens(
        self,
        author: AuthorGmail,
        *,
        refresh_token: str,
        access_token: str,
        updated_by: Optional[str] = None,
    ) -> None:
        author.refresh_token = refresh_token
        author.access_token = access_token
        author.state = None
        author.code_verifier = None
        if updated_by:
            author.updated_by = updated_by
        self.db.flush()


class AdsAccountRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_mail_id(self, mail_id: str) -> list[AdsAccount]:
        stmt = select(AdsAccount).where(AdsAccount.mail_id == mail_id).order_by(AdsAccount.ads_name)
        return list(self.db.execute(stmt).scalars().all())

    def get_by_ads_id_and_user(self, ads_id: str, user_id: str) -> Optional[AdsAccount]:
        stmt = select(AdsAccount).where(
            AdsAccount.ads_id == ads_id,
            AdsAccount.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def bulk_create(self, accounts: list[AdsAccount]) -> None:
        self.db.add_all(accounts)
        self.db.flush()

    def get_all_ads_ids_for_user(self, user_id: str) -> set[str]:
        stmt = select(AdsAccount.ads_id).where(AdsAccount.user_id == user_id)
        return set(self.db.execute(stmt).scalars().all())

    def get_all_for_user(self, user_id: str) -> list[AdsAccount]:
        stmt = select(AdsAccount).where(AdsAccount.user_id == user_id).order_by(AdsAccount.ads_name)
        return list(self.db.execute(stmt).scalars().all())
