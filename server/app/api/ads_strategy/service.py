from __future__ import annotations

import base64
import hashlib
import re
from typing import Any

import httpx
from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.ads_strategy.model import AdsStrategyApiKey, AdsStrategyPrompt, AdsStrategyResult
from app.api.ads_strategy.repository import AdsStrategyRepository
from app.api.ads_strategy.schema import (
    ApiKeyCreate,
    ApiKeyResponse,
    CheckModelsRequest,
    DEFAULT_INPUT_FIELDS,
    DEFAULT_PROMPT_TEMPLATE,
    GenerateRequest,
    GenerateResponse,
    PromptCreate,
    PromptResponse,
    PromptUpdate,
    ResultResponse,
    ResultSaveRequest,
)
from app.core.config import settings
from app.shared.utils import utc_now

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.JWT_SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _encrypt_api_key(api_key: str) -> str:
    return _fernet().encrypt(api_key.encode("utf-8")).decode("utf-8")


def _decrypt_api_key(encrypted_api_key: str) -> str:
    return _fernet().decrypt(encrypted_api_key.encode("utf-8")).decode("utf-8")


def _render_template(template: str, values: dict[str, Any]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1).strip()
        value = values.get(key, "")
        if value is None:
            return ""
        if isinstance(value, (dict, list)):
            return str(value)
        return str(value)

    return re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", replace, template)


def _api_key_to_response(item: AdsStrategyApiKey) -> ApiKeyResponse:
    return ApiKeyResponse(
        id=item.id,
        display_name=item.display_name,
        provider=item.provider,
        model_name=item.model_name,
        api_key_last4=item.api_key_last4,
        is_active=item.is_active,
        last_error=item.last_error,
        last_used_at=item.last_used_at.isoformat() if item.last_used_at else None,
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
    )


def _prompt_to_response(item: AdsStrategyPrompt) -> PromptResponse:
    return PromptResponse(
        id=item.id,
        name=item.name,
        prompt_template=item.prompt_template,
        input_fields=item.input_fields,
        is_default=item.is_default,
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
    )


def _result_to_response(item: AdsStrategyResult) -> ResultResponse:
    return ResultResponse(
        id=item.id,
        title=item.title,
        prompt_id=item.prompt_id,
        api_key_id=item.api_key_id,
        website_url=item.website_url,
        market=item.market,
        budget=item.budget,
        notes=item.notes,
        model_name=item.model_name,
        prompt_text=item.prompt_text,
        response_text=item.response_text,
        raw_response=item.raw_response,
        input_values=item.input_values,
        prompt_tokens=item.prompt_tokens,
        response_tokens=item.response_tokens,
        total_tokens=item.total_tokens,
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
    )


class AdsStrategyService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = AdsStrategyRepository(db)

    def ensure_default_prompt(self, user_id: str) -> None:
        prompts = self.repo.list_prompts(user_id)
        for prompt in prompts:
            if prompt.is_default and (
                "chien-luoc-ads" in prompt.name or "{{response_language}}" not in prompt.prompt_template
            ):
                prompt.name = "Prompt mặc định từ skill-ads"
                prompt.prompt_template = DEFAULT_PROMPT_TEMPLATE
                prompt.input_fields = DEFAULT_INPUT_FIELDS
                self.db.commit()
                return
        if prompts:
            return
        self.repo.create_prompt(
            user_id=user_id,
            name="Prompt mặc định từ skill-ads",
            prompt_template=DEFAULT_PROMPT_TEMPLATE,
            input_fields=DEFAULT_INPUT_FIELDS,
            is_default=True,
        )

    def list_api_keys(self, user_id: str) -> list[ApiKeyResponse]:
        return [_api_key_to_response(item) for item in self.repo.list_api_keys(user_id)]

    def create_api_key(self, user_id: str, payload: ApiKeyCreate) -> ApiKeyResponse:
        api_key = payload.api_key.strip()
        item = self.repo.create_api_key(
            user_id=user_id,
            display_name=payload.display_name.strip(),
            encrypted_api_key=_encrypt_api_key(api_key),
            api_key_last4=api_key[-4:],
            model_name=payload.model_name.strip(),
        )
        return _api_key_to_response(item)

    def delete_api_key(self, user_id: str, api_key_id: str) -> None:
        item = self.repo.get_api_key(user_id, api_key_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy API key.")
        self.repo.delete_api_key(item)

    def list_prompts(self, user_id: str) -> list[PromptResponse]:
        self.ensure_default_prompt(user_id)
        return [_prompt_to_response(item) for item in self.repo.list_prompts(user_id)]

    def create_prompt(self, user_id: str, payload: PromptCreate) -> PromptResponse:
        item = self.repo.create_prompt(
            user_id=user_id,
            name=payload.name.strip(),
            prompt_template=payload.prompt_template,
            input_fields=payload.input_fields,
            is_default=payload.is_default,
        )
        return _prompt_to_response(item)

    def update_prompt(self, user_id: str, prompt_id: str, payload: PromptUpdate) -> PromptResponse:
        item = self.repo.get_prompt(user_id, prompt_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy prompt.")
        updated = self.repo.update_prompt(
            item,
            name=payload.name.strip(),
            prompt_template=payload.prompt_template,
            input_fields=payload.input_fields,
            is_default=payload.is_default,
        )
        return _prompt_to_response(updated)

    def delete_prompt(self, user_id: str, prompt_id: str) -> None:
        item = self.repo.get_prompt(user_id, prompt_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy prompt.")
        self.repo.delete_prompt(item)

    async def generate(self, user_id: str, payload: GenerateRequest) -> GenerateResponse:
        key_item = self.repo.get_api_key(user_id, payload.api_key_id)
        if not key_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Gemini API key.")
        if not key_item.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="API key này đang bị tắt.")

        prompt_id = payload.prompt_id
        template = payload.prompt_template
        if prompt_id:
            prompt = self.repo.get_prompt(user_id, prompt_id)
            if not prompt:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy prompt.")
            template = prompt.prompt_template
        if not template:
            template = DEFAULT_PROMPT_TEMPLATE

        prompt_text = _render_template(template, payload.input_values)
        model_name = (payload.model_name or key_item.model_name or "gemini-2.0-flash").strip()
        api_key = _decrypt_api_key(key_item.encrypted_api_key)
        try:
            data = await self._call_gemini(api_key=api_key, model_name=model_name, prompt_text=prompt_text)
        except HTTPException as exc:
            key_item.last_error = str(exc.detail)
            key_item.last_used_at = utc_now()
            self.db.commit()
            raise

        key_item.last_error = None
        key_item.last_used_at = utc_now()
        self.db.commit()

        return GenerateResponse(
            prompt_text=prompt_text,
            response_text=data["text"],
            model_name=model_name,
            api_key_id=key_item.id,
            prompt_id=prompt_id,
            input_values=payload.input_values,
            raw_response=data["raw"],
            prompt_tokens=data["prompt_tokens"],
            response_tokens=data["response_tokens"],
            total_tokens=data["total_tokens"],
        )

    async def _call_gemini(self, *, api_key: str, model_name: str, prompt_text: str) -> dict[str, Any]:
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt_text}]}],
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.9,
            },
        }
        url = GEMINI_URL.format(model=model_name)
        try:
            async with httpx.AsyncClient(timeout=120.0, trust_env=False) as client:
                response = await client.post(
                    url,
                    headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                    json=body,
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Không thể kết nối Gemini API: {exc}",
            ) from exc

        if response.status_code >= 400:
            detail = self._gemini_error_message(response)
            raise HTTPException(status_code=response.status_code, detail=detail)

        raw = response.json()
        text = self._extract_text(raw)
        usage = raw.get("usageMetadata") or {}
        return {
            "text": text,
            "raw": raw,
            "prompt_tokens": usage.get("promptTokenCount"),
            "response_tokens": usage.get("candidatesTokenCount"),
            "total_tokens": usage.get("totalTokenCount"),
        }

    def _gemini_error_message(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        message = ((payload.get("error") or {}).get("message") or response.text or "").strip()
        status_text = ((payload.get("error") or {}).get("status") or "").upper()
        if response.status_code in {401, 403}:
            return "Gemini API key không hợp lệ hoặc không có quyền truy cập model này. Vui lòng đổi key."
        if response.status_code == 429 or status_text in {"RESOURCE_EXHAUSTED", "QUOTA_EXCEEDED"}:
            return "Gemini API key đã hết quota/token hoặc bị giới hạn tốc độ. Vui lòng đổi key khác."
        return message or "Gemini API trả về lỗi không xác định."

    def _extract_text(self, raw: dict[str, Any]) -> str:
        chunks: list[str] = []
        for candidate in raw.get("candidates") or []:
            content = candidate.get("content") or {}
            for part in content.get("parts") or []:
                text = part.get("text")
                if text:
                    chunks.append(text)
        if chunks:
            return "\n".join(chunks).strip()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini không trả về nội dung văn bản. Hãy kiểm tra prompt hoặc đổi model/API key.",
        )

    def save_result(self, user_id: str, payload: ResultSaveRequest) -> ResultResponse:
        item = self.repo.save_result(user_id, payload)
        return _result_to_response(item)

    def list_results(self, user_id: str) -> list[ResultResponse]:
        return [_result_to_response(item) for item in self.repo.list_results(user_id)]

    def delete_result(self, user_id: str, result_id: str) -> None:
        item = self.repo.get_result(user_id, result_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy kết quả.")
        self.repo.delete_result(item)

    async def list_available_models(self, user_id: str, payload: CheckModelsRequest) -> list[str]:
        api_key = None
        if payload.api_key:
            api_key = payload.api_key.strip()
        elif payload.api_key_id:
            key_item = self.repo.get_api_key(user_id, payload.api_key_id)
            if not key_item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Gemini API key.")
            api_key = _decrypt_api_key(key_item.encrypted_api_key)

        if not api_key:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vui lòng cung cấp API key hoặc API key ID.")

        url = "https://generativelanguage.googleapis.com/v1beta/models"
        try:
            async with httpx.AsyncClient(timeout=15.0, trust_env=False) as client:
                response = await client.get(
                    url,
                    headers={"x-goog-api-key": api_key},
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Không thể kết nối Gemini API để lấy danh sách model: {exc}",
            ) from exc

        if response.status_code >= 400:
            detail = self._gemini_error_message(response)
            raise HTTPException(status_code=response.status_code, detail=detail)

        raw = response.json()
        models = []
        for model in raw.get("models") or []:
            name = model.get("name") or ""
            if name.startswith("models/"):
                name = name[len("models/"):]
            supported_methods = model.get("supportedGenerationMethods") or []
            if "generateContent" in supported_methods:
                models.append(name)
        return sorted(models)
