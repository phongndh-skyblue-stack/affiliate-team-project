"""Bảng quốc gia & ngôn ngữ cho Quét quảng cáo Google.

NGUỒN CHÂN LÝ DUY NHẤT: frontend fetch danh sách này qua endpoint
GET /search-ads/options, nên không bao giờ lệch giữa label hiển thị và
mã `gl`/`hl` thực sự gửi tới Google.

- `gl`  = mã quốc gia ISO-3166 alpha-2 (lowercase) → Google trả SERP địa phương.
- `hl`  = mã ngôn ngữ giao diện.
- `locale` = ngôn ngữ + vùng (vd "de-DE") cho browser context.
"""

from __future__ import annotations

# (value = tên quốc gia tiếng Anh — đồng thời lưu vào lịch sử cho dễ đọc)
# label_vi, gl (ISO2), region
COUNTRIES: list[dict[str, str]] = [
    # ── Đông Nam Á ──
    {"value": "Vietnam", "label": "Việt Nam", "gl": "vn", "region": "Đông Nam Á"},
    {"value": "Thailand", "label": "Thái Lan", "gl": "th", "region": "Đông Nam Á"},
    {"value": "Indonesia", "label": "Indonesia", "gl": "id", "region": "Đông Nam Á"},
    {"value": "Malaysia", "label": "Malaysia", "gl": "my", "region": "Đông Nam Á"},
    {"value": "Singapore", "label": "Singapore", "gl": "sg", "region": "Đông Nam Á"},
    {"value": "Philippines", "label": "Philippines", "gl": "ph", "region": "Đông Nam Á"},
    # ── Đông Á ──
    {"value": "Japan", "label": "Nhật Bản", "gl": "jp", "region": "Đông Á"},
    {"value": "South Korea", "label": "Hàn Quốc", "gl": "kr", "region": "Đông Á"},
    {"value": "China", "label": "Trung Quốc", "gl": "cn", "region": "Đông Á"},
    {"value": "Taiwan", "label": "Đài Loan", "gl": "tw", "region": "Đông Á"},
    {"value": "Hong Kong", "label": "Hồng Kông", "gl": "hk", "region": "Đông Á"},
    # ── Nam Á ──
    {"value": "India", "label": "Ấn Độ", "gl": "in", "region": "Nam Á"},
    {"value": "Pakistan", "label": "Pakistan", "gl": "pk", "region": "Nam Á"},
    {"value": "Bangladesh", "label": "Bangladesh", "gl": "bd", "region": "Nam Á"},
    {"value": "Sri Lanka", "label": "Sri Lanka", "gl": "lk", "region": "Nam Á"},
    # ── Trung Á ──
    {"value": "Kazakhstan", "label": "Kazakhstan", "gl": "kz", "region": "Trung Á"},
    {"value": "Uzbekistan", "label": "Uzbekistan", "gl": "uz", "region": "Trung Á"},
    # ── Châu Âu ──
    {"value": "United Kingdom", "label": "Vương quốc Anh", "gl": "uk", "region": "Châu Âu"},
    {"value": "Germany", "label": "Đức", "gl": "de", "region": "Châu Âu"},
    {"value": "France", "label": "Pháp", "gl": "fr", "region": "Châu Âu"},
    {"value": "Italy", "label": "Ý", "gl": "it", "region": "Châu Âu"},
    {"value": "Spain", "label": "Tây Ban Nha", "gl": "es", "region": "Châu Âu"},
    {"value": "Netherlands", "label": "Hà Lan", "gl": "nl", "region": "Châu Âu"},
    {"value": "Poland", "label": "Ba Lan", "gl": "pl", "region": "Châu Âu"},
    {"value": "Sweden", "label": "Thụy Điển", "gl": "se", "region": "Châu Âu"},
    {"value": "Norway", "label": "Na Uy", "gl": "no", "region": "Châu Âu"},
    {"value": "Denmark", "label": "Đan Mạch", "gl": "dk", "region": "Châu Âu"},
    {"value": "Finland", "label": "Phần Lan", "gl": "fi", "region": "Châu Âu"},
    {"value": "Belgium", "label": "Bỉ", "gl": "be", "region": "Châu Âu"},
    {"value": "Austria", "label": "Áo", "gl": "at", "region": "Châu Âu"},
    {"value": "Switzerland", "label": "Thụy Sĩ", "gl": "ch", "region": "Châu Âu"},
    {"value": "Ireland", "label": "Ireland", "gl": "ie", "region": "Châu Âu"},
    {"value": "Portugal", "label": "Bồ Đào Nha", "gl": "pt", "region": "Châu Âu"},
    {"value": "Greece", "label": "Hy Lạp", "gl": "gr", "region": "Châu Âu"},
    {"value": "Czechia", "label": "Séc", "gl": "cz", "region": "Châu Âu"},
    {"value": "Romania", "label": "Romania", "gl": "ro", "region": "Châu Âu"},
    {"value": "Hungary", "label": "Hungary", "gl": "hu", "region": "Châu Âu"},
    {"value": "Ukraine", "label": "Ukraine", "gl": "ua", "region": "Châu Âu"},
    {"value": "Russia", "label": "Nga", "gl": "ru", "region": "Châu Âu"},
    {"value": "Turkey", "label": "Thổ Nhĩ Kỳ", "gl": "tr", "region": "Châu Âu"},
    # ── Bắc Mỹ ──
    {"value": "United States", "label": "Hoa Kỳ", "gl": "us", "region": "Bắc Mỹ"},
    {"value": "Canada", "label": "Canada", "gl": "ca", "region": "Bắc Mỹ"},
    {"value": "Mexico", "label": "Mexico", "gl": "mx", "region": "Bắc Mỹ"},
    # ── Nam Mỹ ──
    {"value": "Brazil", "label": "Brazil", "gl": "br", "region": "Nam Mỹ"},
    {"value": "Argentina", "label": "Argentina", "gl": "ar", "region": "Nam Mỹ"},
    {"value": "Chile", "label": "Chile", "gl": "cl", "region": "Nam Mỹ"},
    {"value": "Colombia", "label": "Colombia", "gl": "co", "region": "Nam Mỹ"},
    {"value": "Peru", "label": "Peru", "gl": "pe", "region": "Nam Mỹ"},
    # ── Châu Đại Dương ──
    {"value": "Australia", "label": "Úc", "gl": "au", "region": "Châu Đại Dương"},
    {"value": "New Zealand", "label": "New Zealand", "gl": "nz", "region": "Châu Đại Dương"},
    # ── Trung Đông ──
    {"value": "United Arab Emirates", "label": "UAE", "gl": "ae", "region": "Trung Đông"},
    {"value": "Saudi Arabia", "label": "Ả Rập Xê Út", "gl": "sa", "region": "Trung Đông"},
    {"value": "Israel", "label": "Israel", "gl": "il", "region": "Trung Đông"},
]

# value = mã hl gửi cho Google; label hiển thị tiếng Việt
LANGUAGES: list[dict[str, str]] = [
    {"value": "vi", "label": "Tiếng Việt"},
    {"value": "en", "label": "Tiếng Anh"},
    {"value": "ja", "label": "Tiếng Nhật"},
    {"value": "ko", "label": "Tiếng Hàn"},
    {"value": "zh-CN", "label": "Tiếng Trung (Giản thể)"},
    {"value": "zh-TW", "label": "Tiếng Trung (Phồn thể)"},
    {"value": "th", "label": "Tiếng Thái"},
    {"value": "id", "label": "Tiếng Indonesia"},
    {"value": "ms", "label": "Tiếng Mã Lai"},
    {"value": "hi", "label": "Tiếng Hindi"},
    {"value": "de", "label": "Tiếng Đức"},
    {"value": "fr", "label": "Tiếng Pháp"},
    {"value": "es", "label": "Tiếng Tây Ban Nha"},
    {"value": "pt", "label": "Tiếng Bồ Đào Nha"},
    {"value": "it", "label": "Tiếng Ý"},
    {"value": "nl", "label": "Tiếng Hà Lan"},
    {"value": "pl", "label": "Tiếng Ba Lan"},
    {"value": "sv", "label": "Tiếng Thụy Điển"},
    {"value": "ru", "label": "Tiếng Nga"},
    {"value": "tr", "label": "Tiếng Thổ Nhĩ Kỳ"},
    {"value": "ar", "label": "Tiếng Ả Rập"},
]

# ── Bảng tra cứu phái sinh ──────────────────────────────────────────────────
_LOCATION_TO_GL: dict[str, str] = {c["value"].lower(): c["gl"] for c in COUNTRIES}
# Cho phép tra theo cả mã gl (vd "de") lẫn vài bí danh phổ biến
_ALIASES: dict[str, str] = {"us": "us", "usa": "us", "uk": "uk", "vn": "vn"}
# Vùng locale mặc định theo gl (gl "uk" → region "GB")
_GL_TO_REGION: dict[str, str] = {c["gl"]: ("GB" if c["gl"] == "uk" else c["gl"].upper()) for c in COUNTRIES}

_DEFAULT_GL = "us"
_VALID_HL = {lang["value"] for lang in LANGUAGES}


def gl_for_location(location: str | None) -> str:
    """Trả mã `gl` (quốc gia) từ tên location. Fallback an toàn nếu không khớp."""
    if not location:
        return _DEFAULT_GL
    key = location.strip().lower()
    if key in _LOCATION_TO_GL:
        return _LOCATION_TO_GL[key]
    if key in _ALIASES:
        return _ALIASES[key]
    # Nếu người dùng truyền sẵn mã ISO2 hợp lệ
    if len(key) == 2 and key in _GL_TO_REGION:
        return key
    return _DEFAULT_GL


def locale_for(language: str | None, location: str | None) -> str:
    """Ghép locale 'hl-REGION' cho browser context, vd 'de-DE', 'pt-BR'."""
    hl = (language or "en").split("-")[0]
    gl = gl_for_location(location)
    region = _GL_TO_REGION.get(gl, gl.upper())
    return f"{hl}-{region}"


def normalize_hl(language: str | None) -> str:
    """Chuẩn hóa mã ngôn ngữ; fallback 'en' nếu rỗng."""
    return language or "en"
