from __future__ import annotations

import traceback
from datetime import UTC, datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.affiliate_data.repository import AffiliateDataRepository
from app.api.keyword_planner.model import AdsAccount, AuthorGmail, KeywordPlannerJob
from app.api.keyword_planner.repository import (
    AdsAccountRepository,
    AuthorGmailRepository,
    DelegatedMailRepository,
    KeywordPlannerRepository,
)
from app.api.keyword_planner.schema import (
    AccountNode,
    AdsAccountListResponse,
    AdsAccountResponse,
    CallbackResponse,
    ImportAccountsResponse,
    JobListResponse,
    JobResponse,
    JobResultsResponse,
    KeywordIdeaItem,
    MailListResponse,
    MailResponse,
    MonthlySearchVolumeItem,
    ScanByKeywordsRequest,
    ScanByUrlRequest,
    SendAuthResponse,
)
from app.core.config import settings
from app.shared.exceptions import AppHTTPException
from app.shared.services import get_keyword_ideas, get_keyword_ideas_from_url
from app.shared.services.google_ads import get_accounts_for_delegation
from app.shared.services.google_oauth import exchange_code_for_token, generate_authorization_url
from app.shared.services.mail import send_delegation_email


def _job_to_response(job: KeywordPlannerJob, result_count: int = 0) -> JobResponse:
    return JobResponse(
        id=job.id,
        ads_id=job.ads_id,
        input_type=job.input_type,
        keywords=job.keywords,
        page_url=job.page_url,
        use_entire_site=bool(job.use_entire_site),
        language_id=job.language_id,
        location_ids=job.location_ids,
        result_limit=job.result_limit,
        status=job.status,
        error_message=job.error_message,
        result_count=result_count,
        project_id=job.project_id,
        project_name=job.project_name,
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
    )


class KeywordPlannerService:
    def __init__(self, db: Session) -> None:
        self.repo = KeywordPlannerRepository(db)
        self.account_repo = AdsAccountRepository(db)
        self.author_repo = AuthorGmailRepository(db)
        self.db = db

    def _get_project_name(self, user_id: str, project_id: str | None) -> str | None:
        if not project_id:
            return None
        project = AffiliateDataRepository(self.db).get_project_label_by_id_for_user(
            user_id, project_id
        )
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return project[1]

    def _get_refresh_token_for_account(self, ads_id: str, user_id: str) -> tuple[str, str | None]:
        """Return (refresh_token, login_customer_id) for the given ads_id.

        login_customer_id is the MCC parent ads_id when the account is a sub-account.
        Raises HTTPException if account not found or not delegated.
        """
        account = self.account_repo.get_by_ads_id_and_user(ads_id, user_id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy tài khoản Google Ads '{ads_id}'.",
            )
        author = self.author_repo.get_by_mail_id(account.mail_id)
        if not author or not author.refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mail chưa được ủy quyền. Hãy gửi email ủy quyền trước.",
            )
        login_customer_id = account.manager_account_ads_id or None
        return author.refresh_token, login_customer_id

    # ------------------------------------------------------------------
    # Scan endpoints
    # ------------------------------------------------------------------

    def scan_by_keywords(
        self, user_id: Optional[str], payload: ScanByKeywordsRequest
    ) -> JobResultsResponse:
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        refresh_token, login_customer_id = self._get_refresh_token_for_account(
            payload.ads_id, user_id
        )
        project_name = self._get_project_name(user_id, payload.project_id)
        job = self.repo.create_job(
            user_id=user_id,
            ads_id=payload.ads_id,
            input_type="keywords",
            keywords=payload.keywords,
            page_url=payload.page_url,
            use_entire_site=False,
            language_id=payload.language_id,
            location_ids=payload.location_ids or [],
            result_limit=payload.result_limit,
            project_id=payload.project_id,
            project_name=project_name,
        )

        try:
            ideas = get_keyword_ideas(
                keywords=payload.keywords,
                refresh_token=refresh_token,
                customer_id=payload.ads_id,
                login_customer_id=login_customer_id,
                page_url=payload.page_url,
                language_id=payload.language_id,
                location_ids=payload.location_ids or [],
                limit=payload.result_limit,
            )
            results = self.repo.bulk_create_results(job.id, ideas)
            self.repo.mark_job_done(job)
            self.db.commit()
        except Exception as exc:
            self.repo.mark_job_error(job, str(exc))
            self.db.commit()
            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Google Ads API error: {exc}",
            ) from exc

        return JobResultsResponse(
            job=_job_to_response(job, len(results)),
            results=_to_idea_items(results),
        )

    def scan_by_url(
        self, user_id: Optional[str], payload: ScanByUrlRequest
    ) -> JobResultsResponse:
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        refresh_token, login_customer_id = self._get_refresh_token_for_account(
            payload.ads_id, user_id
        )
        project_name = self._get_project_name(user_id, payload.project_id)
        job = self.repo.create_job(
            user_id=user_id,
            ads_id=payload.ads_id,
            input_type="url",
            keywords=None,
            page_url=payload.page_url,
            use_entire_site=payload.use_entire_site,
            language_id=payload.language_id,
            location_ids=payload.location_ids or [],
            result_limit=payload.result_limit,
            project_id=payload.project_id,
            project_name=project_name,
        )

        try:
            ideas = get_keyword_ideas_from_url(
                page_url=payload.page_url,
                refresh_token=refresh_token,
                customer_id=payload.ads_id,
                login_customer_id=login_customer_id,
                use_entire_site=payload.use_entire_site,
                language_id=payload.language_id,
                location_ids=payload.location_ids or [],
                limit=payload.result_limit,
            )
            results = self.repo.bulk_create_results(job.id, ideas)
            self.repo.mark_job_done(job)
            self.db.commit()
        except HTTPException:
            raise
        except Exception as exc:
            self.repo.mark_job_error(job, str(exc))
            self.db.commit()
            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Google Ads API error: {exc}",
            ) from exc

        return JobResultsResponse(
            job=_job_to_response(job, len(results)),
            results=_to_idea_items(results),
        )

    # ------------------------------------------------------------------
    # Query endpoints
    # ------------------------------------------------------------------

    def get_job_results(self, job_id: str) -> JobResultsResponse:
        job = self.repo.get_job_by_id(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
        results = self.repo.get_results_by_job_id(job_id)
        return JobResultsResponse(
            job=_job_to_response(job, len(results)),
            results=_to_idea_items(results),
        )

    def list_jobs(
        self,
        user_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> JobListResponse:
        jobs, total = self.repo.list_jobs(user_id=user_id, skip=skip, limit=limit)
        items = [_job_to_response(j, len(j.results)) for j in jobs]
        return JobListResponse(items=items, total=total)

    def list_all_accounts(self, user_id: str) -> AdsAccountListResponse:
        """Return all imported Google Ads accounts for the current user (across all mails)."""
        accounts = self.account_repo.get_all_for_user(user_id)
        items = [_account_to_response(a) for a in accounts]
        return AdsAccountListResponse(total=len(items), items=items)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_idea_items(results) -> list[KeywordIdeaItem]:
    items = []
    for r in results:
        monthly = [
            MonthlySearchVolumeItem(
                year=ms["year"], month=ms["month"], searches=ms["searches"]
            )
            for ms in (r.monthly_searches or [])
        ]
        items.append(
            KeywordIdeaItem(
                id=r.id,
                keyword=r.keyword,
                avg_monthly_searches=r.avg_monthly_searches,
                competition=r.competition,
                competition_index=r.competition_index,
                low_top_page_bid=r.low_top_page_bid,
                high_top_page_bid=r.high_top_page_bid,
                monthly_searches=monthly,
            )
        )
    return items


# ===========================================================================
# Mail Delegation Service
# ===========================================================================


class MailDelegationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.mail_repo = DelegatedMailRepository(db)
        self.author_repo = AuthorGmailRepository(db)
        self.account_repo = AdsAccountRepository(db)

    # ------------------------------------------------------------------
    # Mails
    # ------------------------------------------------------------------

    def add_mail(self, email: str, user: User) -> MailResponse:
        existing = self.mail_repo.get_by_email_and_user(email, user.id)
        if existing:
            raise AppHTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{email}' đã tồn tại trong danh sách của bạn.",
            )
        mail = self.mail_repo.create(email=email, user_id=user.id)
        self.db.commit()
        return self._mail_to_response(mail)

    def list_mails(self, user: User, skip: int = 0, limit: int = 50) -> MailListResponse:
        items, total = self.mail_repo.list_by_user(user.id, skip=skip, limit=limit)
        return MailListResponse(
            total=total,
            items=[self._mail_to_response(m) for m in items],
        )

    def delete_mail(self, mail_id: str, user: User) -> None:
        mail = self._get_mail_or_404(mail_id, user)
        self.mail_repo.delete(mail)
        self.db.commit()

    # ------------------------------------------------------------------
    # Delegation — send auth email
    # ------------------------------------------------------------------

    def send_auth_email(self, mail_id: str, user: User) -> SendAuthResponse:
        mail = self._get_mail_or_404(mail_id, user)
        author = self.author_repo.get_by_mail_id(mail_id)

        if author and author.is_delegated:
            raise AppHTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{mail.email}' đã được ủy quyền rồi.",
            )

        auth_url, state, code_verifier = generate_authorization_url()
        expires_at = datetime.now(UTC) + timedelta(
            minutes=settings.GOOGLE_OAUTH_STATE_EXPIRATION_MINUTES
        )

        if author is None:
            self.author_repo.create(
                mail_id=mail_id,
                created_by=user.id,
                state=state,
                code_verifier=code_verifier,
                expires_in=expires_at,
            )
        else:
            self.author_repo.update_state(
                author,
                state=state,
                code_verifier=code_verifier,
                expires_in=expires_at,
                updated_by=user.id,
            )
        self.db.commit()

        send_delegation_email(to=mail.email, auth_url=auth_url, expires_at=expires_at)

        resp = SendAuthResponse(
            message=f"Email ủy quyền đã được gửi tới {mail.email}.",
            expires_at=expires_at,
        )
        if settings.DEBUG:
            resp.auth_url = auth_url
        return resp

    # ------------------------------------------------------------------
    # Delegation — OAuth callback
    # ------------------------------------------------------------------

    def handle_callback(self, code: str, state: str) -> CallbackResponse:
        author = self.author_repo.get_by_state(state)
        if author is None:
            raise AppHTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State không hợp lệ hoặc đã hết hạn.",
            )

        expires = author.expires_in
        now_utc = datetime.now(UTC)
        # SQLite returns naive datetimes — strip tzinfo for comparison if needed
        if expires and expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires and expires < now_utc:
            raise AppHTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Link ủy quyền đã hết hạn. Vui lòng yêu cầu gửi lại.",
            )

        if not author.code_verifier:
            raise AppHTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PKCE code_verifier không tồn tại.",
            )

        try:
            token_result = exchange_code_for_token(code=code, code_verifier=author.code_verifier)
        except Exception as exc:
            raise AppHTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Không thể xác thực với Google: {exc}",
            ) from exc

        mail = author.delegated_mail
        if token_result["email"].lower() != mail.email.lower():
            raise AppHTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Tài khoản Google đăng nhập ({token_result['email']}) "
                    f"không khớp với email cần ủy quyền ({mail.email})."
                ),
            )

        self.author_repo.save_tokens(
            author,
            refresh_token=token_result["refresh_token"],
            access_token=token_result["access_token"],
        )
        self.db.commit()

        try:
            scan_result = get_accounts_for_delegation(token_result["refresh_token"])
        except Exception:
            scan_result = {"accounts": [], "unaccessible_ids": []}

        # Auto-save all discovered accounts to DB
        existing_ids = self.account_repo.get_all_ads_ids_for_user(mail.user_id)
        new_accounts: list[AdsAccount] = []
        for acc in scan_result["accounts"]:
            if acc["ads_id"] not in existing_ids:
                new_accounts.append(
                    AdsAccount(
                        mail_id=mail.id,
                        user_id=mail.user_id,
                        ads_id=acc["ads_id"],
                        ads_name=acc.get("ads_name", acc["ads_id"]),
                        ads_status=acc.get("ads_status"),
                        currency_code=acc.get("currency_code"),
                        timezone=acc.get("timezone"),
                        manager_account_ads_id=acc.get("manager_account_ads_id") or None,
                        budget_paid=acc.get("budget_paid"),
                        budget_used=acc.get("budget_used"),
                        budget_adjustment=acc.get("budget_adjustment"),
                    )
                )
        if new_accounts:
            self.account_repo.bulk_create(new_accounts)
            self.db.commit()

        account_nodes = _build_account_tree(scan_result["accounts"], set())

        return CallbackResponse(
            message="Ủy quyền thành công.",
            mail_id=mail.id,
            accounts=account_nodes,
            unaccessible_ids=scan_result.get("unaccessible_ids", []),
        )

    # ------------------------------------------------------------------
    # Accounts
    # ------------------------------------------------------------------

    def list_accounts(self, mail_id: str, user: User) -> list[AdsAccountResponse]:
        self._get_mail_or_404(mail_id, user)
        accounts = self.account_repo.get_by_mail_id(mail_id)
        return [_account_to_response(a) for a in accounts]

    def import_accounts(
        self, mail_id: str, ads_ids: list[str], user: User
    ) -> ImportAccountsResponse:
        mail = self._get_mail_or_404(mail_id, user)
        author = self.author_repo.get_by_mail_id(mail_id)
        if not author or not author.is_delegated:
            raise AppHTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mail chưa được ủy quyền. Hãy gửi email ủy quyền trước.",
            )

        try:
            scan_result = get_accounts_for_delegation(author.refresh_token)
            fetched: dict[str, dict] = {a["ads_id"]: a for a in scan_result["accounts"]}
        except Exception:
            fetched = {}

        existing = {a.ads_id for a in self.account_repo.get_by_mail_id(mail_id)}
        new_accounts: list[AdsAccount] = []
        for ads_id in ads_ids:
            if ads_id in existing:
                continue
            meta = fetched.get(ads_id, {})
            new_accounts.append(
                AdsAccount(
                    mail_id=mail_id,
                    user_id=user.id,
                    ads_id=ads_id,
                    ads_name=meta.get("ads_name", ads_id),
                    ads_status=meta.get("ads_status"),
                    currency_code=meta.get("currency_code"),
                    timezone=meta.get("timezone"),
                    manager_account_ads_id=meta.get("manager_account_ads_id") or None,
                )
            )

        if new_accounts:
            self.account_repo.bulk_create(new_accounts)
            self.db.commit()

        all_accounts = self.account_repo.get_by_mail_id(mail_id)
        return ImportAccountsResponse(
            message=f"Đã import {len(new_accounts)} tài khoản.",
            imported=len(new_accounts),
            accounts=[_account_to_response(a) for a in all_accounts],
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_mail_or_404(self, mail_id: str, user: User):
        mail = self.mail_repo.get_by_id(mail_id)
        if not mail or mail.user_id != user.id:
            raise AppHTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy mail.",
            )
        return mail

    def _mail_to_response(self, mail) -> MailResponse:
        author: AuthorGmail | None = mail.author_gmail
        imported_accounts = [_account_to_response(a) for a in (mail.accounts or [])]
        return MailResponse(
            id=mail.id,
            email=mail.email,
            user_id=mail.user_id,
            created_at=mail.created_at,
            is_delegated=author.is_delegated if author else False,
            expires_in=author.expires_in if author else None,
            accounts=imported_accounts,
        )


# ---------------------------------------------------------------------------
# Mail delegation helpers
# ---------------------------------------------------------------------------


def _build_account_tree(
    flat: list[dict], already_imported: set[str]
) -> list[AccountNode]:
    nodes: dict[str, AccountNode] = {}
    for acc in flat:
        nodes[acc["ads_id"]] = AccountNode(
            ads_id=acc["ads_id"],
            ads_name=acc.get("ads_name", acc["ads_id"]),
            ads_status=acc.get("ads_status"),
            currency_code=acc.get("currency_code"),
            timezone=acc.get("timezone"),
            is_manager=acc.get("is_manager", False),
            manager_account_ads_id=acc.get("manager_account_ads_id", ""),
            is_already_in_database=acc["ads_id"] in already_imported,
        )
    roots: list[AccountNode] = []
    for node in nodes.values():
        parent_id = node.manager_account_ads_id
        if parent_id and parent_id in nodes:
            nodes[parent_id].sub_accounts.append(node)
        else:
            roots.append(node)
    return roots


def _account_to_response(a: AdsAccount) -> AdsAccountResponse:
    return AdsAccountResponse(
        id=a.id,
        mail_id=a.mail_id,
        ads_id=a.ads_id,
        ads_name=a.ads_name,
        ads_status=a.ads_status,
        account_type=a.account_type,
        manager_account_ads_id=a.manager_account_ads_id,
        currency_code=a.currency_code,
        timezone=a.timezone,
        budget_paid=a.budget_paid,
        budget_used=a.budget_used,
        budget_adjustment=a.budget_adjustment,
        created_at=a.created_at,
    )
