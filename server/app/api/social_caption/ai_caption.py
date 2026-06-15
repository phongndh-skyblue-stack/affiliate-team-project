"""Sinh caption mạng xã hội bằng Gemini, theo đúng spec từng platform + compliance."""

from __future__ import annotations

import logging

from app.api.social_caption.platform_specs import (
    COMPLIANCE_RULES,
    detect_industries,
    get_goal,
    get_platform,
)
from app.shared.services.gemini import generate_json

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """Bạn là chuyên gia viết caption mạng xã hội cho affiliate marketing,
thành thạo Facebook, Instagram, TikTok, LinkedIn, Threads, X. Bạn viết hook mạnh
(dừng scroll trong 2 giây), đúng format và char-limit từng nền tảng, CTA cụ thể.

Nguyên tắc cốt lõi:
- Hook PHẢI nằm trong vùng hiển thị trước khi bị cắt của nền tảng.
- Đúng cấu trúc theo mục tiêu; CTA cụ thể (không "liên hệ"/"click here" chung chung).
- Trung thực: KHÔNG bịa số liệu/% /testimonial. Thiếu dữ liệu → dùng [PLACEHOLDER: ...].
- Bảo toàn affiliate link nguyên vẹn nếu được cung cấp (không rút gọn, không sửa params).
- Output PHẢI là JSON hợp lệ, không text thừa ngoài JSON.

""" + COMPLIANCE_RULES


def _build_user_prompt(payload, platform: dict, goal: dict, industries: list[str]) -> str:
    hashtag_rule = (
        "KHÔNG dùng hashtag."
        if platform["hashtag_max"] == 0
        else f"{platform['hashtag_min']}-{platform['hashtag_max']} hashtag, đặt ở {platform['hashtag_pos']}."
    )
    lang_rule = {
        "vi": "Viết caption bằng TIẾNG VIỆT.",
        "en": "Viết caption bằng TIẾNG ANH.",
        "auto": "Tự chọn ngôn ngữ theo thị trường: mặc định Tiếng Việt, dùng Tiếng Anh nếu thương hiệu/ý tưởng hướng quốc tế.",
    }.get(payload.language, "Mặc định Tiếng Việt.")

    industry_note = (
        f"\n⚠️ NGÀNH NHẠY CẢM phát hiện: {', '.join(industries)}. Áp dụng nghiêm quy tắc compliance + thêm disclaimer phù hợp."
        if industries
        else ""
    )
    tiktok_note = (
        '\n- "hook_on_screen": 1 câu hook ON-SCREEN ≤7 từ cho video (BẮT BUỘC với TikTok).'
        if platform["value"] == "tiktok"
        else ""
    )

    keyword_line = (
        f"- Keyword SEO (ưu tiên đưa vào nội dung/hashtag tự nhiên): {', '.join(payload.keywords)}\n"
        if payload.keywords
        else ""
    )
    competitor_line = (
        "- Góc quảng cáo đối thủ (HÃY TẠO KHÁC BIỆT, không lặp lại, tìm angle riêng):\n"
        + "\n".join(f"  • {a}" for a in payload.competitor_angles[:10])
        + "\n"
        if payload.competitor_angles
        else ""
    )

    return f"""Viết {payload.variants} biến thể caption cho nền tảng {platform['label']}.

THÔNG TIN:
- Ý tưởng/sản phẩm: {payload.idea}
- Mục tiêu: {goal['label']} → cấu trúc gợi ý: {goal['structure']}
- Đối tượng/persona: {payload.segment or "(chưa rõ — viết cho khách hàng phổ thông phù hợp ý tưởng)"}
- Thương hiệu: {payload.brand_name or "(không có)"}
- Tone: {payload.tone or "(tự chọn cho phù hợp)"}
- Affiliate URL (giữ NGUYÊN VẸN trong CTA nếu có): {payload.affiliate_url or "(không có)"}
{keyword_line}{competitor_line}- {lang_rule}{industry_note}

YÊU CẦU FORMAT NỀN TẢNG {platform['label']}:
- Giới hạn ký tự cứng: {platform['char_limit']}. Hook phải nằm trong ~{platform['hook_cutoff']} ký tự đầu.
- {hashtag_rule}
- {platform['link_note']}
- {platform['format_note']}

Trả về ĐÚNG JSON sau (không text ngoài JSON):
{{
  "detected_industries": ["..."],
  "compliance_notes": ["mô tả ngắn các từ đã điều chỉnh & disclaimer đã thêm"],
  "placeholders": ["liệt kê [PLACEHOLDER] còn trống nếu có"],
  "captions": [
    {{
      "segment": "tên/đặc điểm đối tượng của biến thể này",
      "content": "nội dung caption hoàn chỉnh (đã gồm CTA, KHÔNG gồm hashtag)",
      "hashtags": ["hashtag1", "hashtag2"],{tiktok_note}
      "visual_suggestion": "1-2 câu gợi ý ảnh/video đi kèm",
      "cta_text": "nội dung CTA ngắn"
    }}
  ]
}}

Yêu cầu: đúng {payload.variants} phần tử trong "captions". Mỗi caption content nằm trong giới hạn ký tự."""


async def generate_captions(payload) -> dict:
    """Gọi Gemini sinh caption; trả về dict thô (service sẽ hậu kiểm)."""
    platform = get_platform(payload.platform)
    goal = get_goal(payload.goal)
    # Quét ngành nhạy cảm từ ý tưởng + segment + keyword + góc đối thủ
    scan_text = " ".join([
        payload.idea, payload.segment or "", payload.brand_name or "",
        " ".join(payload.keywords), " ".join(payload.competitor_angles),
    ])
    industries = detect_industries(scan_text)

    user_prompt = _build_user_prompt(payload, platform, goal, industries)
    logger.info("✍️ Sinh %d caption %s (mục tiêu %s)", payload.variants, platform["label"], goal["label"])

    data = await generate_json(_SYSTEM_PROMPT, user_prompt, temperature=0.85, max_output_tokens=4096)

    # Đảm bảo ngành phát hiện phía server luôn có (không phụ thuộc model)
    merged = set(data.get("detected_industries") or []) | set(industries)
    data["detected_industries"] = sorted(merged)
    return data
