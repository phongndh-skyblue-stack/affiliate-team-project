from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.ads_strategy.model import AdsStrategyApiKey, AdsStrategyPrompt, AdsStrategyResult
from app.api.ads_strategy.schema import ResultSaveRequest


class AdsStrategyRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_api_keys(self, user_id: str) -> list[AdsStrategyApiKey]:
        stmt = (
            select(AdsStrategyApiKey)
            .where(AdsStrategyApiKey.user_id == user_id)
            .order_by(AdsStrategyApiKey.created_at.desc())
        )
        return list(self.db.scalars(stmt))

    def get_api_key(self, user_id: str, api_key_id: str) -> AdsStrategyApiKey | None:
        stmt = select(AdsStrategyApiKey).where(
            AdsStrategyApiKey.id == api_key_id,
            AdsStrategyApiKey.user_id == user_id,
        )
        return self.db.scalar(stmt)

    def create_api_key(
        self,
        *,
        user_id: str,
        display_name: str,
        encrypted_api_key: str,
        api_key_last4: str,
        model_name: str,
    ) -> AdsStrategyApiKey:
        item = AdsStrategyApiKey(
            user_id=user_id,
            display_name=display_name,
            encrypted_api_key=encrypted_api_key,
            api_key_last4=api_key_last4,
            model_name=model_name,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete_api_key(self, item: AdsStrategyApiKey) -> None:
        self.db.delete(item)
        self.db.commit()

    def list_prompts(self, user_id: str) -> list[AdsStrategyPrompt]:
        stmt = (
            select(AdsStrategyPrompt)
            .where(AdsStrategyPrompt.user_id == user_id)
            .order_by(AdsStrategyPrompt.is_default.desc(), AdsStrategyPrompt.updated_at.desc())
        )
        return list(self.db.scalars(stmt))

    def get_prompt(self, user_id: str, prompt_id: str) -> AdsStrategyPrompt | None:
        stmt = select(AdsStrategyPrompt).where(
            AdsStrategyPrompt.id == prompt_id,
            AdsStrategyPrompt.user_id == user_id,
        )
        return self.db.scalar(stmt)

    def create_prompt(
        self,
        *,
        user_id: str,
        name: str,
        prompt_template: str,
        input_fields: list[dict],
        is_default: bool,
    ) -> AdsStrategyPrompt:
        if is_default:
            self.clear_default_prompts(user_id)
        item = AdsStrategyPrompt(
            user_id=user_id,
            name=name,
            prompt_template=prompt_template,
            input_fields=input_fields,
            is_default=is_default,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update_prompt(
        self,
        item: AdsStrategyPrompt,
        *,
        name: str,
        prompt_template: str,
        input_fields: list[dict],
        is_default: bool,
    ) -> AdsStrategyPrompt:
        if is_default:
            self.clear_default_prompts(item.user_id)
        item.name = name
        item.prompt_template = prompt_template
        item.input_fields = input_fields
        item.is_default = is_default
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete_prompt(self, item: AdsStrategyPrompt) -> None:
        self.db.delete(item)
        self.db.commit()

    def clear_default_prompts(self, user_id: str) -> None:
        for prompt in self.list_prompts(user_id):
            prompt.is_default = False
        self.db.flush()

    def save_result(self, user_id: str, payload: ResultSaveRequest) -> AdsStrategyResult:
        item = AdsStrategyResult(
            user_id=user_id,
            title=payload.title,
            prompt_id=payload.prompt_id,
            api_key_id=payload.api_key_id,
            website_url=payload.website_url,
            market=payload.market,
            budget=payload.budget,
            notes=payload.notes,
            model_name=payload.model_name,
            prompt_text=payload.prompt_text,
            response_text=payload.response_text,
            raw_response=payload.raw_response,
            input_values=payload.input_values,
            prompt_tokens=payload.prompt_tokens,
            response_tokens=payload.response_tokens,
            total_tokens=payload.total_tokens,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def list_results(self, user_id: str) -> list[AdsStrategyResult]:
        stmt = (
            select(AdsStrategyResult)
            .where(AdsStrategyResult.user_id == user_id)
            .order_by(AdsStrategyResult.created_at.desc())
        )
        return list(self.db.scalars(stmt))

    def get_result(self, user_id: str, result_id: str) -> AdsStrategyResult | None:
        stmt = select(AdsStrategyResult).where(
            AdsStrategyResult.id == result_id,
            AdsStrategyResult.user_id == user_id,
        )
        return self.db.scalar(stmt)

    def delete_result(self, item: AdsStrategyResult) -> None:
        self.db.delete(item)
        self.db.commit()
