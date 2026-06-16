from __future__ import annotations

from typing import Any

from pydantic import Field, field_validator

from app.shared.responses import CamelModel


DEFAULT_INPUT_FIELDS = [
    {"key": "website_url", "label": "Website hoặc Landing Page", "type": "url", "required": True},
    {"key": "market", "label": "Thị trường ưu tiên", "type": "text", "required": False},
    {"key": "budget", "label": "Ngân sách dự kiến", "type": "text", "required": False},
    {"key": "response_language", "label": "Ngôn ngữ kết quả", "type": "select", "required": False},
    {"key": "notes", "label": "Ghi chú bổ sung", "type": "textarea", "required": False},
]


DEFAULT_PROMPT_TEMPLATE = """Hãy đóng vai Chuyên gia Phân tích Thị trường & Lập kế hoạch chiến dịch Google Ads Search.

Website/Landing page: {{website_url}}
Thị trường ưu tiên: {{market}}
Ngân sách dự kiến: {{budget}}
Ngôn ngữ kết quả mong muốn: {{response_language}}
Ghi chú bổ sung: {{notes}}

Nhiệm vụ:
1. Đọc và phân tích website để xác định sản phẩm/dịch vụ, ngành hàng, ưu thế cốt lõi và khuyến mãi hiện có nếu có.
2. Kiểm tra cảnh báo chính sách Google Ads liên quan trực tiếp đến ngành hàng.
3. Xuất toàn bộ báo cáo trong một câu trả lời theo đúng cấu trúc dưới đây.

## 1. Phân tích sản phẩm, đối thủ và thị trường
- Xác định sản phẩm/dịch vụ là gì.
- Xác định thị trường mục tiêu và giai đoạn hiện tại của ngành: tăng trưởng, bão hòa hoặc suy giảm. Phải có số liệu, thống kê hoặc nguồn nghiên cứu thị trường để hỗ trợ; không kết luận cảm tính.
- Đề xuất thị trường địa lý tối ưu nhất.
- Phân tích 5 đối thủ trực tiếp cùng ngành. Với mỗi đối thủ, nêu rõ:
  - Strengths: lợi thế, tính năng hoặc điểm mạnh nổi bật.
  - Weaknesses: hạn chế, điểm yếu hoặc khoảng trống dịch vụ.
- Xác định USP độc quyền khiến sản phẩm chính nổi bật hơn 5 đối thủ trên.

## 2. Phân tích Google Search keywords
- Kiểm tra khả năng brand bidding. Nếu brand bidding bị cấm hoặc rủi ro, tự động chuyển sang solution-based keywords hoặc competitor/alternative keywords.
- Tạo bảng keyword bằng tiếng Anh. Ưu tiên mạnh Exact Match để kiểm soát ngân sách.
- Với mỗi keyword, cung cấp volume ước tính theo 3 tháng gần nhất và phân tích xu hướng 3 tháng: tăng, giảm hoặc đi ngang.
- Phân tích search intent và nhu cầu thật của người tìm kiếm.

## 3. Phân khúc khách hàng mục tiêu
Phân tích ít nhất 3 tệp khách hàng cốt lõi. Với mỗi tệp, trình bày:
- Demographics: độ tuổi, giới tính, lối sống, hành vi.
- Pain Points & Barriers: vấn đề họ gặp và rào cản chuyển đổi.
- Needs & Desires: kỳ vọng thực chất khi dùng sản phẩm.
- Messaging Angle: hướng thông điệp thuyết phục nhất.

## 4. Đề xuất Google Ads Search campaign và content
- Đề xuất cấu trúc Ad Groups tối ưu theo từng phân khúc khách hàng.
- Đề xuất keyword kèm match type phù hợp, ưu tiên Exact Match cho tối ưu ngân sách và chuyển đổi.
- Viết Responsive Search Ads theo từng phân khúc khách hàng. Số mẫu ad copy phải đúng bằng số tệp khách hàng đã phân tích.
- Mỗi mẫu RSA phải gồm:
  - 15 Headlines bằng tiếng Anh, mỗi headline tối đa 30 ký tự. Lồng ghép urgency/scarcity nếu website có khuyến mãi.
  - 4 Descriptions bằng tiếng Anh, mỗi description tối đa 90 ký tự.
- Viết 4 Callouts bằng tiếng Anh, mỗi callout tối đa 25 ký tự.
- Viết 4 Sitelinks bằng tiếng Anh. Mỗi sitelink gồm title tối đa 25 ký tự, 2 dòng description tối đa 35 ký tự mỗi dòng và URL.
- Nếu URL người dùng có tham số referral như ?ref= hoặc ?fpr=, mọi sitelink/final URL phải giữ và append đúng tham số đó để tracking affiliate.
- Đề xuất Negative Keywords List bằng tiếng Anh để tránh query rác như free, crack, login, support...
- Phác thảo cấu trúc Bridge Page / Pre-lander để tăng Quality Score và tránh rủi ro direct redirect.
- Ngân sách khởi đầu đề xuất bắt buộc tối thiểu $50 - $100/ngày hoặc cao hơn.

Quy tắc bắt buộc:
- Báo cáo phân tích, giải thích và customer segment phải viết theo ngôn ngữ kết quả mong muốn: {{response_language}}.
- Toàn bộ ad content, target keywords, negative keywords, callouts và sitelinks viết bằng tiếng Anh.
- Giải thích thuật ngữ như Exact Match, Ad Group, Responsive Search Ads bằng ngôn ngữ kết quả đã chọn khi nhắc lần đầu.
- Không bịa số liệu, search volume hoặc market growth. Nếu không có dữ liệu realtime, ghi rõ [ESTIMATED].
- Với Crypto/Forex, tuyệt đối tránh từ dễ bị hạn chế trong ad copy như crypto, forex, trading, bitcoin, token, coin, giao dịch, kiếm tiền, đầu tư, invest, profit, signals. Dùng cách diễn đạt an toàn hơn như digital assets, contracts, copying, following, automating, monitoring.
- Luôn giải thích lý do đằng sau các đề xuất quan trọng bằng chữ nghiêng."""


class ApiKeyCreate(CamelModel):
    display_name: str = Field(..., min_length=1, max_length=120)
    api_key: str = Field(..., min_length=10)
    model_name: str = Field("gemini-2.5-flash", min_length=1, max_length=80)


class ApiKeyResponse(CamelModel):
    id: str
    display_name: str
    provider: str
    model_name: str
    api_key_last4: str
    is_active: bool
    last_error: str | None
    last_used_at: str | None
    created_at: str
    updated_at: str


class ApiKeyListResponse(CamelModel):
    total: int
    items: list[ApiKeyResponse]


class CheckModelsRequest(CamelModel):
    api_key: str | None = Field(None, min_length=10)
    api_key_id: str | None = Field(None)


class CheckModelsResponse(CamelModel):
    models: list[str]


class PromptCreate(CamelModel):
    name: str = Field(..., min_length=1, max_length=160)
    prompt_template: str = Field(..., min_length=20)
    input_fields: list[dict[str, Any]] = Field(default_factory=lambda: DEFAULT_INPUT_FIELDS.copy())
    is_default: bool = False


class PromptUpdate(CamelModel):
    name: str = Field(..., min_length=1, max_length=160)
    prompt_template: str = Field(..., min_length=20)
    input_fields: list[dict[str, Any]] = Field(default_factory=lambda: DEFAULT_INPUT_FIELDS.copy())
    is_default: bool = False


class PromptResponse(CamelModel):
    id: str
    name: str
    prompt_template: str
    input_fields: list[dict[str, Any]]
    is_default: bool
    created_at: str
    updated_at: str


class PromptListResponse(CamelModel):
    total: int
    items: list[PromptResponse]


class GenerateRequest(CamelModel):
    api_key_id: str
    prompt_id: str | None = None
    prompt_template: str | None = None
    input_values: dict[str, Any] = Field(default_factory=dict)
    model_name: str | None = Field(None, max_length=80)

    @field_validator("input_values")
    @classmethod
    def validate_input_values(cls, value: dict[str, Any]) -> dict[str, Any]:
        website_url = str(value.get("website_url") or "").strip()
        if not website_url:
            raise ValueError("website_url is required")
        return value


class GenerateResponse(CamelModel):
    prompt_text: str
    response_text: str
    model_name: str
    api_key_id: str
    prompt_id: str | None
    input_values: dict[str, Any]
    raw_response: dict[str, Any] | None = None
    prompt_tokens: int | None = None
    response_tokens: int | None = None
    total_tokens: int | None = None


class ResultSaveRequest(CamelModel):
    title: str = Field(..., min_length=1, max_length=255)
    api_key_id: str | None = None
    prompt_id: str | None = None
    website_url: str = ""
    market: str = ""
    budget: str = ""
    notes: str = ""
    model_name: str = ""
    prompt_text: str = Field(..., min_length=1)
    response_text: str = Field(..., min_length=1)
    raw_response: dict[str, Any] | None = None
    input_values: dict[str, Any] = Field(default_factory=dict)
    prompt_tokens: int | None = None
    response_tokens: int | None = None
    total_tokens: int | None = None


class ResultResponse(CamelModel):
    id: str
    title: str
    prompt_id: str | None
    api_key_id: str | None
    website_url: str
    market: str
    budget: str
    notes: str
    model_name: str
    prompt_text: str
    response_text: str
    raw_response: dict[str, Any] | None
    input_values: dict[str, Any]
    prompt_tokens: int | None
    response_tokens: int | None
    total_tokens: int | None
    created_at: str
    updated_at: str


class ResultListResponse(CamelModel):
    total: int
    items: list[ResultResponse]


class CountryResponse(CamelModel):
    code: str
    name_vi: str
    name_en: str

