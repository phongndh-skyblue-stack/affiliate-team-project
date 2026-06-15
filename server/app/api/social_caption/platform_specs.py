"""Đặc tả nền tảng + compliance cho Social Caption Writer.

Port tri thức từ skill social-caption-writer (platform-specs, caption-structures,
compliance-guide) sang dạng Python có cấu trúc để build prompt và hậu kiểm.
"""

from __future__ import annotations

# ── Nền tảng ────────────────────────────────────────────────────────────────
# char_limit: giới hạn cứng; hook_cutoff: ngưỡng "hiển thị trước khi cắt"
# (hook PHẢI nằm trong vùng này); hashtag_min/max + vị trí; link_note; format_note
PLATFORMS: list[dict] = [
    {
        "value": "facebook", "label": "Facebook",
        "char_limit": 63206, "hook_cutoff": 477,
        "hashtag_min": 1, "hashtag_max": 3, "hashtag_pos": "cuối bài",
        "link_note": "Link hoạt động nhưng FB giảm reach — cân nhắc để link ở comment đầu.",
        "format_note": "Hook 1-2 dòng đầu (trong ~477 ký tự); đoạn 2-3 câu, nhiều line break; emoji tiết chế 3-5.",
    },
    {
        "value": "instagram", "label": "Instagram",
        "char_limit": 2200, "hook_cutoff": 125,
        "hashtag_min": 5, "hashtag_max": 15, "hashtag_pos": "cuối, tách bằng dấu chấm/xuống dòng",
        "link_note": "Link trong caption KHÔNG bấm được — dùng 'link in bio'.",
        "format_note": "Hook dòng đầu (trong ~125 ký tự); white space; mix hashtag broad+niche+branded.",
    },
    {
        "value": "tiktok", "label": "TikTok",
        "char_limit": 2200, "hook_cutoff": 100,
        "hashtag_min": 3, "hashtag_max": 6, "hashtag_pos": "trong caption",
        "link_note": "Link không bấm được trong caption.",
        "format_note": "QUAN TRỌNG: hook nằm ON-SCREEN 3 giây đầu video; caption chỉ bổ trợ. Luôn gợi ý 1 hook on-screen ngắn (≤7 từ).",
    },
    {
        "value": "linkedin", "label": "LinkedIn",
        "char_limit": 3000, "hook_cutoff": 210,
        "hashtag_min": 3, "hashtag_max": 5, "hashtag_pos": "cuối bài",
        "link_note": "Link giảm reach — ưu tiên để link ở comment.",
        "format_note": "Tone professional có cá tính; mỗi ý 1 dòng, nhiều white space; mở bằng insight/data, không bắt đầu bằng 'Tôi'.",
    },
    {
        "value": "threads", "label": "Threads",
        "char_limit": 500, "hook_cutoff": 500,
        "hashtag_min": 0, "hashtag_max": 0, "hashtag_pos": "không hỗ trợ hashtag",
        "link_note": "Link hoạt động.",
        "format_note": "Ngắn 1-3 câu, KHÔNG hashtag, giọng hội thoại; có thể dạng thread chain.",
    },
    {
        "value": "x", "label": "X (Twitter)",
        "char_limit": 280, "hook_cutoff": 280,
        "hashtag_min": 1, "hashtag_max": 2, "hashtag_pos": "trong text hoặc cuối",
        "link_note": "Link hoạt động.",
        "format_note": "Tối đa 280 ký tự, súc tích, mỗi từ có lý do tồn tại.",
    },
]

# ── Mục tiêu caption ─────────────────────────────────────────────────────────
GOALS: list[dict] = [
    {"value": "sales", "label": "Bán hàng",
     "structure": "HOOK → PAIN → SOLUTION → PROOF → CTA"},
    {"value": "education", "label": "Giáo dục",
     "structure": "HOOK → INSIGHT → BREAKDOWN (3-5 ý) → TAKEAWAY → ENGAGE/SAVE"},
    {"value": "community", "label": "Cộng đồng",
     "structure": "STORY OPEN (thật, personal) → RELATE → INVITE (tag/chia sẻ)"},
    {"value": "engagement", "label": "Tăng tương tác",
     "structure": "HOOK gây tò mò → VALUE ngắn → câu hỏi mở/CTA tương tác"},
    {"value": "announcement", "label": "Thông báo",
     "structure": "HOOK → thông tin chính rõ ràng → CTA/chi tiết"},
]

# ── Ngôn ngữ ─────────────────────────────────────────────────────────────────
LANGUAGES: list[dict] = [
    {"value": "auto", "label": "Tự động (theo thị trường)"},
    {"value": "vi", "label": "Tiếng Việt"},
    {"value": "en", "label": "Tiếng Anh"},
]

# ── Phát hiện ngành nhạy cảm (vi + en) ───────────────────────────────────────
_INDUSTRY_KEYWORDS: dict[str, list[str]] = {
    "Crypto/Forex": [
        "crypto", "bitcoin", "btc", "eth", "token", "altcoin", "forex", "trading",
        "giao dịch", "sàn forex", "tín hiệu", "signal", "copy trade", "copy trading",
        "đầu tư sinh lời", "x2 tài khoản", "lệnh", "đòn bẩy", "leverage",
    ],
    "Tài chính & Đầu tư": [
        "đầu tư", "lợi nhuận", "lãi suất", "chứng khoán", "cổ phiếu", "quỹ", "sinh lời",
        "vay", "tín dụng", "lãi kép",
    ],
    "Y tế & Sức khỏe": [
        "chữa", "điều trị", "khỏi bệnh", "bác sĩ", "thuốc", "tác dụng phụ", "bệnh",
        "phác đồ", "đặc trị",
    ],
    "TPCN & Làm đẹp": [
        "giảm cân", "tăng cơ", "detox", "thải độc", "trắng da", "nám", "tàn nhang",
        "mụn", "collagen", "thực phẩm chức năng", "đốt mỡ", "giảm mỡ",
    ],
    "Giáo dục & Khóa học": [
        "cam kết việc làm", "đảm bảo đầu ra", "đảm bảo việc làm", "học xong có việc",
        "chứng chỉ", "cam kết đầu ra",
    ],
    "Bất động sản": [
        "bất động sản", "sinh lời chắc chắn", "pháp lý", "sổ đỏ", "sổ hồng",
        "căn hộ", "đất nền", "dự án", "tăng giá",
    ],
    "Cờ bạc/Cá cược": [
        "cá cược", "cờ bạc", "casino", "đặt cược", "nổ hũ", "kèo", "nhà cái",
    ],
}


def detect_industries(text: str) -> list[str]:
    """Trả về danh sách ngành nhạy cảm phát hiện trong text (rỗng nếu không có)."""
    low = (text or "").lower()
    found = []
    for industry, kws in _INDUSTRY_KEYWORDS.items():
        if any(kw in low for kw in kws):
            found.append(industry)
    return found


def get_platform(value: str) -> dict:
    for p in PLATFORMS:
        if p["value"] == value:
            return p
    return PLATFORMS[0]


def get_goal(value: str) -> dict:
    for g in GOALS:
        if g["value"] == value:
            return g
    return GOALS[0]


# ── Quy tắc compliance chung (đưa vào system prompt) ─────────────────────────
COMPLIANCE_RULES = """QUY TẮC COMPLIANCE (bắt buộc tuân thủ, áp dụng compliant-by-design):
- KHÔNG hứa kết quả/lợi nhuận cụ thể, không "đảm bảo lợi nhuận", "100% hiệu quả",
  "chữa khỏi", "cam kết việc làm", "sinh lời chắc chắn".
- Ngành tài chính/crypto/forex: thay "trading/đầu tư sinh lời" bằng "tìm hiểu/phân tích
  thị trường"; KHÔNG nêu % lợi nhuận; thêm disclaimer "không phải lời khuyên đầu tư".
- Ngành y tế/TPCN: thay "điều trị/chữa khỏi" bằng "hỗ trợ cải thiện"; thêm "Kết quả có
  thể khác nhau tùy cơ địa".
- KHÔNG dùng ALL CAPS cả từ/câu; tối đa 1 dấu chấm than; không "!!!", không ký tự rác.
- KHÔNG bịa số liệu, % , số khách hàng, testimonial. Nếu thiếu dữ liệu thật, dùng
  [PLACEHOLDER: mô tả] thay vì bịa.
- Urgency/khan hiếm chỉ dùng khi CÓ THẬT.
- Mọi điều chỉnh/thay thế phải liệt kê trong "compliance_notes"."""
