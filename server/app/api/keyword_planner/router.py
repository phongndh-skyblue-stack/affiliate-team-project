from __future__ import annotations

from typing import Optional

import anyio
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.keyword_planner.model import DelegatedMail
from app.api.keyword_planner.schema import (
    AdsAccountListResponse,
    AddMailRequest,
    CallbackResponse,
    CandidateCreateRequest,
    CandidateListResponse,
    CandidatePromoteRequest,
    CandidateResponse,
    CandidateUpdateRequest,
    DelegationCallbackRequest,
    ImportAccountsRequest,
    ImportAccountsResponse,
    JobListResponse,
    JobResultsResponse,
    MailListResponse,
    MailResponse,
    ScanByKeywordsRequest,
    ScanByUrlRequest,
    SendAuthResponse,
)
from app.api.keyword_planner.service import (
    KeywordCandidateService,
    KeywordPlannerService,
    MailDelegationService,
)
from app.api.notifications.service import NotificationService
from app.core.database import get_db
from app.shared.deps import get_current_user
from app.shared.responses import MessageResponse
from app.shared.ws_manager import emit_to_user


# ---------------------------------------------------------------------------
# Keyword Planner
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/keyword-planner", tags=["Keyword Planner"])


def get_kp_service(db: Session = Depends(get_db)) -> KeywordPlannerService:
    return KeywordPlannerService(db)


@router.get("/accounts", response_model=AdsAccountListResponse,
            summary="Danh sách tất cả Google Ads accounts của user")
def list_all_accounts(
    current_user: User = Depends(get_current_user),
    service: KeywordPlannerService = Depends(get_kp_service),
) -> AdsAccountListResponse:
    return service.list_all_accounts(current_user.id)


@router.post("/scan/keywords", response_model=JobResultsResponse,
             summary="Quét keyword ideas từ seed keywords")
async def scan_by_keywords(
    payload: ScanByKeywordsRequest,
    current_user: User = Depends(get_current_user),
    service: KeywordPlannerService = Depends(get_kp_service),
) -> JobResultsResponse:
    return service.scan_by_keywords(current_user.id, payload)


@router.post("/scan/url", response_model=JobResultsResponse,
             summary="Quét keyword ideas từ URL")
async def scan_by_url(
    payload: ScanByUrlRequest,
    current_user: User = Depends(get_current_user),
    service: KeywordPlannerService = Depends(get_kp_service),
) -> JobResultsResponse:
    return service.scan_by_url(current_user.id, payload)


@router.get("/jobs", response_model=JobListResponse,
            summary="Danh sách keyword planner jobs")
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    service: KeywordPlannerService = Depends(get_kp_service),
) -> JobListResponse:
    return service.list_jobs(user_id=current_user.id, skip=skip, limit=limit)


@router.get("/jobs/{job_id}/results", response_model=JobResultsResponse,
            summary="Kết quả keyword ideas theo job ID")
def get_job_results(
    job_id: str,
    current_user: User = Depends(get_current_user),
    service: KeywordPlannerService = Depends(get_kp_service),
) -> JobResultsResponse:
    return service.get_job_results(job_id, current_user.id)


def get_candidate_service(db: Session = Depends(get_db)) -> KeywordCandidateService:
    return KeywordCandidateService(db)


@router.post("/candidates", response_model=CandidateResponse, status_code=201)
def create_candidate(
    body: CandidateCreateRequest,
    current_user: User = Depends(get_current_user),
    service: KeywordCandidateService = Depends(get_candidate_service),
) -> CandidateResponse:
    return service.create_candidate(current_user.id, body)


@router.get("/candidates", response_model=CandidateListResponse)
def list_candidates(
    candidate_status: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    service: KeywordCandidateService = Depends(get_candidate_service),
) -> CandidateListResponse:
    return service.list_candidates(
        current_user.id, status_filter=candidate_status, skip=skip, limit=limit
    )


@router.get("/candidates/{candidate_id}", response_model=CandidateResponse)
def get_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    service: KeywordCandidateService = Depends(get_candidate_service),
) -> CandidateResponse:
    return service.get_candidate(candidate_id, current_user.id)


@router.patch("/candidates/{candidate_id}", response_model=CandidateResponse)
def update_candidate(
    candidate_id: str,
    body: CandidateUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: KeywordCandidateService = Depends(get_candidate_service),
) -> CandidateResponse:
    return service.update_candidate(candidate_id, current_user.id, body)


@router.delete("/candidates/{candidate_id}", response_model=MessageResponse)
def delete_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    service: KeywordCandidateService = Depends(get_candidate_service),
) -> MessageResponse:
    service.delete_candidate(candidate_id, current_user.id)
    return MessageResponse(message="Đã xóa dự án tiềm năng.")


@router.post("/candidates/{candidate_id}/promote", response_model=CandidateResponse)
def promote_candidate(
    candidate_id: str,
    body: CandidatePromoteRequest,
    current_user: User = Depends(get_current_user),
    service: KeywordCandidateService = Depends(get_candidate_service),
) -> CandidateResponse:
    return service.promote_candidate(candidate_id, current_user.id, body)


# ---------------------------------------------------------------------------
# Mail Delegation
# ---------------------------------------------------------------------------

mail_router = APIRouter(prefix="/mail-delegation", tags=["Mail Delegation"])


def get_md_service(db: Session = Depends(get_db)) -> MailDelegationService:
    return MailDelegationService(db)


@mail_router.post("/mails", response_model=MailResponse, status_code=201)
def add_mail(
    body: AddMailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return MailDelegationService(db).add_mail(str(body.email), current_user)


@mail_router.get("/mails", response_model=MailListResponse)
def list_mails(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    service: MailDelegationService = Depends(get_md_service),
    current_user: User = Depends(get_current_user),
):
    return service.list_mails(current_user, skip=skip, limit=limit)


@mail_router.delete("/mails/{mail_id}", response_model=MessageResponse)
def delete_mail(
    mail_id: str,
    service: MailDelegationService = Depends(get_md_service),
    current_user: User = Depends(get_current_user),
):
    service.delete_mail(mail_id, current_user)
    return MessageResponse(message="Đã xóa mail thành công.")


@mail_router.post("/mails/{mail_id}/send-auth", response_model=SendAuthResponse)
def send_auth_email(
    mail_id: str,
    service: MailDelegationService = Depends(get_md_service),
    current_user: User = Depends(get_current_user),
):
    return service.send_auth_email(mail_id, current_user)


@mail_router.post("/callback", response_model=CallbackResponse)
async def delegation_callback(
    body: DelegationCallbackRequest,
    db: Session = Depends(get_db),
):
    """Public — no auth required."""
    service = MailDelegationService(db)
    result: CallbackResponse = await anyio.to_thread.run_sync(
        lambda: service.handle_callback(code=body.code, state=body.state),
        cancellable=True,
    )

    # Push Socket.IO notification to the mail owner
    mail = db.get(DelegatedMail, result.mail_id)
    if mail:
        payload = {
            "mailId": result.mail_id,
            "mailEmail": mail.email,
            "message": result.message,
            "accounts": [a.model_dump(mode="json") for a in result.accounts],
            "unaccessibleIds": result.unaccessible_ids,
        }
        # Persist to DB so it survives if the user is offline
        NotificationService(db).create(
            user_id=mail.user_id,
            type="delegation_result",
            payload=payload,
        )
        # Also push real-time via Socket.IO
        await emit_to_user(mail.user_id, "delegation_result", payload)

    return result


@mail_router.get("/mails/{mail_id}/accounts", response_model=AdsAccountListResponse)
def list_accounts(
    mail_id: str,
    service: MailDelegationService = Depends(get_md_service),
    current_user: User = Depends(get_current_user),
):
    items = service.list_accounts(mail_id, current_user)
    return AdsAccountListResponse(total=len(items), items=items)


@mail_router.post("/mails/{mail_id}/accounts/import", response_model=ImportAccountsResponse)
def import_accounts(
    mail_id: str,
    body: ImportAccountsRequest,
    service: MailDelegationService = Depends(get_md_service),
    current_user: User = Depends(get_current_user),
):
    return service.import_accounts(mail_id, body.ads_ids, current_user)


# ---------------------------------------------------------------------------
# Debug / Test endpoints (no auth)
# ---------------------------------------------------------------------------

class _TestDelegationRequest(BaseModel):
    refresh_token: str


@mail_router.post(
    "/debug/test-delegation",
    summary="[DEBUG] Test get_accounts_for_delegation with a refresh_token (no auth)",
)
def debug_test_delegation(body: _TestDelegationRequest):
    """No auth — for quick testing of the Google Ads delegation scan."""
    from app.shared.services.google_ads import get_accounts_for_delegation
    result = get_accounts_for_delegation(body.refresh_token)
    return result

