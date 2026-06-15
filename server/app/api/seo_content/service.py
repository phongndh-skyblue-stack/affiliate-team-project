from __future__ import annotations

import re
from sqlalchemy.orm import Session

from app.api.seo_content.model import SeoContent
from app.api.seo_content.repository import SeoContentRepository
from app.api.seo_content.schema import (
    SeoContentCreate,
    SeoContentUpdate,
    SeoScoreRequest,
    SeoScoreResponse,
    KeywordScoreBreakdown,
)
from app.shared.exceptions import AppHTTPException


class SeoContentService:
    def __init__(self, db: Session) -> None:
        self.repository = SeoContentRepository(db)

    def calculate_seo_score(self, data: SeoScoreRequest) -> SeoScoreResponse:
        score = 0
        warnings = []
        breakdowns = []

        title = data.seo_title or ""
        desc = data.meta_description or ""
        headlines = [h for h in (data.headlines or []) if h.strip()]
        descriptions = [d for d in (data.descriptions or []) if d.strip()]
        keywords = [k.strip().lower() for k in (data.keywords or []) if k.strip()]
        body = data.body_content or ""

        # 1. Title evaluation (Max 20 points)
        if not title:
            warnings.append("Tiêu đề SEO đang trống")
        else:
            score += 5
            title_len = len(title)
            if 40 <= title_len <= 60:
                score += 15
            else:
                score += 8
                warnings.append(
                    f"Độ dài tiêu đề SEO ({title_len} ký tự) chưa tối ưu. Nên nằm trong khoảng 40-60 ký tự."
                )

        # 2. Meta description evaluation (Max 20 points)
        if not desc:
            warnings.append("Thẻ mô tả (Meta Description) đang trống")
        else:
            score += 5
            desc_len = len(desc)
            if 120 <= desc_len <= 160:
                score += 15
            else:
                score += 8
                warnings.append(
                    f"Độ dài mô tả ({desc_len} ký tự) chưa tối ưu. Nên nằm trong khoảng 120-160 ký tự."
                )

        # 3. Ads Headlines & Descriptions variety (Max 20 points)
        if len(headlines) >= 3:
            score += 10
        elif len(headlines) > 0:
            score += 3
            warnings.append("Nên viết ít nhất 3 tiêu đề quảng cáo để tối ưu phân phối hiển thị.")
        else:
            warnings.append("Tiêu đề quảng cáo đang trống.")

        if len(descriptions) >= 2:
            score += 10
        elif len(descriptions) > 0:
            score += 3
            warnings.append("Nên viết ít nhất 2 đoạn mô tả quảng cáo.")
        else:
            warnings.append("Mô tả quảng cáo đang trống.")

        # 4. Keyword optimization (Max 40 points)
        if not keywords:
            warnings.append("Chưa thêm từ khóa mục tiêu để tính điểm tối ưu SEO.")
        else:
            words_in_body = len(re.findall(r"\w+", body.lower())) if body else 0
            points_per_location = 10.0 / len(keywords)

            title_lower = title.lower()
            desc_lower = desc.lower()
            headlines_lower = [h.lower() for h in headlines] + [d.lower() for d in descriptions]
            body_lower = body.lower()

            keyword_score = 0.0

            for kw in keywords:
                # Find in Title
                in_title = kw in title_lower
                if in_title:
                    keyword_score += points_per_location

                # Find in Meta Description
                in_desc = kw in desc_lower
                if in_desc:
                    keyword_score += points_per_location

                # Find in Headlines/Descriptions
                in_headlines = any(kw in h for h in headlines_lower)
                if in_headlines:
                    keyword_score += points_per_location

                # Find in Body & Density
                in_body = kw in body_lower
                count_in_body = body_lower.count(kw) if in_body else 0
                density = (count_in_body / words_in_body * 100.0) if words_in_body > 0 else 0.0
                
                if in_body:
                    # Target density 1.0% - 3.5% is ideal
                    if 1.0 <= density <= 3.5:
                        keyword_score += points_per_location
                    else:
                        keyword_score += points_per_location * 0.5
                        if density > 3.5:
                            warnings.append(
                                f"Mật độ từ khóa '{kw}' quá cao ({density:.2f}%). Tránh nhồi nhét từ khóa."
                            )
                        else:
                            warnings.append(
                                f"Mật độ từ khóa '{kw}' quá thấp ({density:.2f}%). Nên xuất hiện nhiều hơn trong thân bài."
                            )

                breakdowns.append(
                    KeywordScoreBreakdown(
                        keyword=kw,
                        found_in_title=in_title,
                        found_in_description=in_desc,
                        found_in_headlines=in_headlines,
                        found_in_body=in_body,
                        body_density=round(density, 2),
                    )
                )

            score += int(keyword_score)

        # Ensure bounds
        score = max(0, min(100, score))

        return SeoScoreResponse(
            score=score,
            warnings=warnings,
            keyword_breakdown=breakdowns,
        )

    def get_by_id(self, item_id: str, user_id: str) -> SeoContent:
        item = self.repository.get_by_id(item_id, user_id)
        if not item:
            raise AppHTTPException(status_code=404, detail="Không tìm thấy bản ghi SEO Content.")
        return item

    def list_by_user_id(self, user_id: str) -> list[SeoContent]:
        return self.repository.list_by_user_id(user_id)

    def create(self, user_id: str, payload: SeoContentCreate) -> SeoContent:
        score_req = SeoScoreRequest(
            seo_title=payload.seo_title,
            meta_description=payload.meta_description,
            headlines=payload.headlines,
            descriptions=payload.descriptions,
            keywords=payload.keywords,
            body_content=payload.body_content,
        )
        score_res = self.calculate_seo_score(score_req)
        return self.repository.create(user_id, payload, score_res.score)

    def update(self, user_id: str, item_id: str, payload: SeoContentUpdate) -> SeoContent:
        item = self.get_by_id(item_id, user_id)
        
        # Merge old and new values for score calculation
        merged_title = payload.seo_title if payload.seo_title is not None else item.seo_title
        merged_desc = payload.meta_description if payload.meta_description is not None else item.meta_description
        merged_headlines = payload.headlines if payload.headlines is not None else item.headlines
        merged_descriptions = payload.descriptions if payload.descriptions is not None else item.descriptions
        merged_keywords = payload.keywords if payload.keywords is not None else item.keywords
        merged_body = payload.body_content if payload.body_content is not None else item.body_content

        score_req = SeoScoreRequest(
            seo_title=merged_title,
            meta_description=merged_desc,
            headlines=merged_headlines,
            descriptions=merged_descriptions,
            keywords=merged_keywords,
            body_content=merged_body,
        )
        score_res = self.calculate_seo_score(score_req)
        
        return self.repository.update(item, payload, score_res.score)

    def delete(self, user_id: str, item_id: str) -> None:
        item = self.get_by_id(item_id, user_id)
        self.repository.delete(item)
