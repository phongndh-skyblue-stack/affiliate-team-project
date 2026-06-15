from __future__ import annotations

from app.api.social_caption import ai_caption
from app.api.social_caption.platform_specs import get_goal, get_platform
from app.api.social_caption.schema import (
    CaptionGenerateRequest,
    CaptionGenerateResponse,
    CaptionVariant,
)


async def generate(payload: CaptionGenerateRequest) -> CaptionGenerateResponse:
    platform = get_platform(payload.platform)
    goal = get_goal(payload.goal)
    data = await ai_caption.generate_captions(payload)

    variants: list[CaptionVariant] = []
    for item in data.get("captions", []):
        content = (item.get("content") or "").strip()
        hashtags = [h.strip().lstrip("#") for h in (item.get("hashtags") or []) if h and h.strip()]
        # char_count tính trên content + hashtag (cách hiển thị thực tế trên nền tảng)
        hashtag_text = (" " + " ".join(f"#{h}" for h in hashtags)) if hashtags else ""
        char_count = len(content) + len(hashtag_text)
        # Hook = dòng đầu tiên — chỉ cần dòng này nằm trong vùng hiển thị trước khi cắt
        first_line = content.split("\n", 1)[0]

        variants.append(
            CaptionVariant(
                platform=platform["value"],
                goal=goal["value"],
                language=payload.language,
                segment=item.get("segment"),
                content=content,
                hashtags=hashtags,
                char_count=char_count,
                char_limit=platform["char_limit"],
                hook_cutoff=platform["hook_cutoff"],
                within_limit=char_count <= platform["char_limit"],
                within_hook_cutoff=len(first_line) <= platform["hook_cutoff"],
                hook_on_screen=item.get("hook_on_screen"),
                visual_suggestion=item.get("visual_suggestion"),
                # Bảo toàn affiliate link nguyên vẹn — không lấy từ model
                cta_link=payload.affiliate_url or None,
            )
        )

    return CaptionGenerateResponse(
        captions=variants,
        detected_industries=data.get("detected_industries") or [],
        compliance_notes=data.get("compliance_notes") or [],
        placeholders=data.get("placeholders") or [],
    )
