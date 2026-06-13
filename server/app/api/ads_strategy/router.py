from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.ads_strategy.schema import (
    ApiKeyCreate,
    ApiKeyListResponse,
    ApiKeyResponse,
    GenerateRequest,
    GenerateResponse,
    PromptCreate,
    PromptListResponse,
    PromptResponse,
    PromptUpdate,
    ResultListResponse,
    ResultResponse,
    ResultSaveRequest,
)
from app.api.ads_strategy.service import AdsStrategyService
from app.api.auth.model import User
from app.core.database import get_db
from app.shared.deps import get_current_user

router = APIRouter(prefix="/ads-strategy", tags=["Ads Strategy Skill"])


def get_service(db: Session = Depends(get_db)) -> AdsStrategyService:
    return AdsStrategyService(db)


@router.get("/api-keys", response_model=ApiKeyListResponse)
def list_api_keys(
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> ApiKeyListResponse:
    items = service.list_api_keys(current_user.id)
    return ApiKeyListResponse(total=len(items), items=items)


@router.post("/api-keys", response_model=ApiKeyResponse)
def create_api_key(
    payload: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> ApiKeyResponse:
    return service.create_api_key(current_user.id, payload)


@router.delete("/api-keys/{api_key_id}", status_code=204, response_model=None)
def delete_api_key(
    api_key_id: str,
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> None:
    service.delete_api_key(current_user.id, api_key_id)


@router.get("/prompts", response_model=PromptListResponse)
def list_prompts(
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> PromptListResponse:
    items = service.list_prompts(current_user.id)
    return PromptListResponse(total=len(items), items=items)


@router.post("/prompts", response_model=PromptResponse)
def create_prompt(
    payload: PromptCreate,
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> PromptResponse:
    return service.create_prompt(current_user.id, payload)


@router.put("/prompts/{prompt_id}", response_model=PromptResponse)
def update_prompt(
    prompt_id: str,
    payload: PromptUpdate,
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> PromptResponse:
    return service.update_prompt(current_user.id, prompt_id, payload)


@router.delete("/prompts/{prompt_id}", status_code=204, response_model=None)
def delete_prompt(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> None:
    service.delete_prompt(current_user.id, prompt_id)


@router.post("/generate", response_model=GenerateResponse)
async def generate_strategy(
    payload: GenerateRequest,
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> GenerateResponse:
    return await service.generate(current_user.id, payload)


@router.get("/results", response_model=ResultListResponse)
def list_results(
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> ResultListResponse:
    items = service.list_results(current_user.id)
    return ResultListResponse(total=len(items), items=items)


@router.post("/results", response_model=ResultResponse)
def save_result(
    payload: ResultSaveRequest,
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> ResultResponse:
    return service.save_result(current_user.id, payload)


@router.delete("/results/{result_id}", status_code=204, response_model=None)
def delete_result(
    result_id: str,
    current_user: User = Depends(get_current_user),
    service: AdsStrategyService = Depends(get_service),
) -> None:
    service.delete_result(current_user.id, result_id)
