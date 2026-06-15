from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.seo_content.model import SeoContent
from app.api.seo_content.schema import SeoContentCreate, SeoContentUpdate


class SeoContentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, id: str, user_id: str | None = None) -> SeoContent | None:
        stmt = select(SeoContent).where(SeoContent.id == id)
        if user_id is not None:
            stmt = stmt.where(SeoContent.user_id == user_id)
        return self.db.scalar(stmt)

    def list_by_user_id(self, user_id: str) -> list[SeoContent]:
        stmt = (
            select(SeoContent)
            .where(SeoContent.user_id == user_id)
            .order_by(SeoContent.created_at.desc())
        )
        return list(self.db.scalars(stmt))

    def create(self, user_id: str, payload: SeoContentCreate, seo_score: int) -> SeoContent:
        item = SeoContent(
            user_id=user_id,
            project_name=payload.project_name,
            final_url=payload.final_url,
            display_path=payload.display_path,
            seo_title=payload.seo_title,
            meta_description=payload.meta_description,
            headlines=payload.headlines,
            descriptions=payload.descriptions,
            keywords=payload.keywords,
            body_content=payload.body_content,
            user_persona=payload.user_persona,
            seo_score=seo_score,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update(self, item: SeoContent, payload: SeoContentUpdate, seo_score: int) -> SeoContent:
        if payload.project_name is not None:
            item.project_name = payload.project_name
        if payload.final_url is not None:
            item.final_url = payload.final_url
        if payload.display_path is not None:
            item.display_path = payload.display_path
        if payload.seo_title is not None:
            item.seo_title = payload.seo_title
        if payload.meta_description is not None:
            item.meta_description = payload.meta_description
        if payload.headlines is not None:
            item.headlines = payload.headlines
        if payload.descriptions is not None:
            item.descriptions = payload.descriptions
        if payload.keywords is not None:
            item.keywords = payload.keywords
        if payload.body_content is not None:
            item.body_content = payload.body_content
        if payload.user_persona is not None:
            item.user_persona = payload.user_persona

        item.seo_score = seo_score
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete(self, item: SeoContent) -> None:
        self.db.delete(item)
        self.db.commit()
