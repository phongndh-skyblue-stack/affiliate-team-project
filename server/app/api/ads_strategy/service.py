from __future__ import annotations

from datetime import UTC, datetime
from urllib.parse import urlparse

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.ads_strategy.schema import (
    AdGroupPlan,
    AdsStrategyRequest,
    AdsStrategyResponse,
    BudgetAllocation,
    BudgetPlan,
    CustomerSegment,
    PolicyWarning,
    RsaCopy,
    Sitelink,
    StrategyKeyword,
)
from app.api.affiliate_data.model import AffiliateLink
from app.api.keyword_planner.model import KeywordPlannerJob, KeywordPlannerResult
from app.api.search_ads.model import GoogleAdsSavedCompetitor, GoogleAdsSearch


class AdsStrategyService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def build(self, user_id: str, payload: AdsStrategyRequest) -> AdsStrategyResponse:
        link = self._get_link(user_id, payload.affiliate_link_id)
        latest_traffic = _latest(link.traffic_scans)
        latest_project = _latest(link.project_data_scans)
        latest_brand_keywords = _latest(link.brand_keyword_scans)

        keyword_results = self._get_keyword_results(user_id, link)
        competitors = self._get_competitors(user_id, link.domain)
        search_histories = self._get_search_histories(user_id, link.domain)

        keywords = _build_keywords(link.domain, keyword_results, latest_brand_keywords, competitors)
        project_text = _project_text(latest_project)
        product_summary = _product_summary(link.domain, latest_project)
        market_stage = _market_stage(latest_traffic, keywords, competitors, search_histories)
        geo_recommendation = _geo_recommendation(latest_traffic, latest_project)
        policy_warnings = _policy_warnings(latest_project, project_text)
        segments = _customer_segments(link.domain, latest_project, keywords)
        ad_groups = _ad_groups(keywords)
        rsa = _rsa_copy(link, latest_project, keywords)
        budget_plan = _budget_plan(payload, keywords, latest_project, latest_traffic)
        data_notes = _data_notes(latest_traffic, latest_project, keyword_results, competitors, search_histories)

        return AdsStrategyResponse(
            affiliate_link_id=link.id,
            website=link.affiliate_url,
            domain=link.domain,
            generated_at=datetime.now(UTC).isoformat(),
            product_summary=product_summary,
            market_stage=market_stage,
            geo_recommendation=geo_recommendation,
            data_confidence=_data_confidence(data_notes),
            data_notes=data_notes,
            policy_warnings=policy_warnings,
            keyword_table=keywords[:24],
            customer_segments=segments,
            ad_groups=ad_groups,
            rsa=rsa,
            budget_plan=budget_plan,
        )

    def _get_link(self, user_id: str, affiliate_link_id: str) -> AffiliateLink:
        stmt = (
            select(AffiliateLink)
            .options(
                selectinload(AffiliateLink.traffic_scans),
                selectinload(AffiliateLink.brand_keyword_scans),
                selectinload(AffiliateLink.project_data_scans),
            )
            .where(AffiliateLink.id == affiliate_link_id, AffiliateLink.user_id == user_id)
        )
        link = self.db.scalar(stmt)
        if not link:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Affiliate link not found")
        return link

    def _get_keyword_results(self, user_id: str, link: AffiliateLink) -> list[KeywordPlannerResult]:
        domain = _normalize_domain(link.domain)
        brand = _brand_root(domain)
        stmt = (
            select(KeywordPlannerResult)
            .join(KeywordPlannerJob)
            .where(KeywordPlannerJob.user_id == user_id, KeywordPlannerJob.status == "done")
            .order_by(KeywordPlannerResult.avg_monthly_searches.desc())
            .limit(500)
        )
        rows = list(self.db.scalars(stmt))
        output: list[KeywordPlannerResult] = []
        for row in rows:
            job = row.job
            page_domain = _normalize_domain(job.page_url)
            seeds = " ".join(job.keywords or [])
            text = " ".join([row.keyword or "", page_domain, seeds]).lower()
            if domain and (domain in text or page_domain.endswith(domain)):
                output.append(row)
            elif brand and brand in text:
                output.append(row)
        return output[:80]

    def _get_competitors(self, user_id: str, domain: str) -> list[GoogleAdsSavedCompetitor]:
        brand = _brand_root(domain)
        stmt = (
            select(GoogleAdsSavedCompetitor)
            .where(GoogleAdsSavedCompetitor.user_id == user_id)
            .order_by(GoogleAdsSavedCompetitor.created_at.desc())
            .limit(200)
        )
        rows = list(self.db.scalars(stmt))
        return [
            row for row in rows
            if _matches_brand(" ".join([
                row.keyword or "",
                row.advertiser_domain or "",
                row.display_url or "",
                row.target_url or "",
            ]), domain, brand)
        ][:40]

    def _get_search_histories(self, user_id: str, domain: str) -> list[GoogleAdsSearch]:
        brand = _brand_root(domain)
        stmt = (
            select(GoogleAdsSearch)
            .options(selectinload(GoogleAdsSearch.ads))
            .where(GoogleAdsSearch.user_id == user_id)
            .order_by(GoogleAdsSearch.created_at.desc())
            .limit(100)
        )
        rows = list(self.db.scalars(stmt))
        return [row for row in rows if _matches_brand(row.keyword, domain, brand)][:30]


def _latest(rows):
    return sorted(rows or [], key=lambda item: item.created_at, reverse=True)[0] if rows else None


def _normalize_domain(value: str | None) -> str:
    text = (value or "").strip().lower()
    if not text:
        return ""
    parsed = urlparse(text if "://" in text else f"https://{text}")
    host = (parsed.netloc or parsed.path).split("/")[0]
    return host.removeprefix("www.")


def _brand_root(domain: str) -> str:
    parts = _normalize_domain(domain).split(".")
    if len(parts) <= 2:
        return parts[0] if parts else ""
    if parts[-2] in {"com", "co", "net", "org"} and len(parts) >= 3:
        return parts[-3]
    return parts[-2]


def _matches_brand(value: str | None, domain: str, brand: str) -> bool:
    text = (value or "").lower()
    return bool(text and ((domain and domain in text) or (brand and brand in text)))


def _clean(value: str | None) -> str:
    return " ".join((value or "").replace("\n", " ").split())


def _truncate(value: str, limit: int) -> str:
    text = _clean(value)
    if len(text) <= limit:
        return text
    cut = text[: limit + 1]
    pos = cut.rfind(" ")
    return (cut[:pos] if pos > limit * 0.55 else cut[:limit]).strip()


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        text = _clean(value)
        key = text.lower()
        if text and key not in seen:
            seen.add(key)
            output.append(text)
    return output


def _project_text(project) -> str:
    if not project:
        return ""
    result_text = " ".join(
        _clean(str(item.get(key, "")))
        for item in (project.results or [])
        if isinstance(item, dict)
        for key in ("title", "content", "snippet", "raw_content")
    )
    return " ".join(filter(None, [
        project.project_name,
        project.event_content,
        project.sale_content,
        project.answer,
        result_text,
    ]))


def _product_summary(domain: str, project) -> str:
    if not project:
        return f"Chưa có project scan cho {domain}; brief đang dựa trên domain, keyword và dữ liệu đối thủ đã lưu."
    parts = [
        project.project_name or domain,
        project.sale_content or project.event_content,
        project.answer,
    ]
    return _truncate(". ".join(filter(None, parts)), 320)


def _market_stage(traffic, keywords: list[StrategyKeyword], competitors, histories) -> str:
    volume = sum(item.avg_monthly_searches or 0 for item in keywords[:10])
    visits = getattr(traffic, "monthly_visits", 0) if traffic else 0
    competitor_count = len(competitors) + sum(len(h.ads) for h in histories)
    if visits >= 100_000 and volume >= 20_000 and competitor_count >= 5:
        return "Bão hòa/cạnh tranh cao: đã có traffic, nhu cầu search và nhiều advertiser cùng xuất hiện."
    if visits >= 10_000 or volume >= 5_000 or competitor_count >= 2:
        return "Đang phát triển: có tín hiệu thị trường đủ để test ngân sách có kiểm soát."
    return "Cần kiểm chứng: dữ liệu hiện tại còn mỏng, nên test nhỏ hoặc quét thêm traffic/keyword trước."


def _geo_recommendation(traffic, project) -> str:
    restricted = {str(item.get("country", "")).lower() for item in (getattr(project, "restricted_countries", None) or [])}
    countries = list((getattr(traffic, "traffic_details", None) or {}).get("country") or []) if traffic else []
    valid = [
        item for item in countries
        if str(item.get("country_name", "")).lower() not in restricted
    ]
    if valid:
        top = valid[0]
        return f"Ưu tiên {top.get('country_name')} vì chiếm khoảng {float(top.get('traffic_share_percentage') or 0):.2f}% traffic và chưa nằm trong nhóm restricted."
    if getattr(project, "top_countries", None):
        top = project.top_countries[0]
        return f"Ưu tiên kiểm tra {top.get('country')} vì được phát hiện trong dữ liệu dự án; cần đối chiếu restriction trước khi chạy."
    return "Chưa có country signal đủ rõ; nên quét traffic SimilarWeb hoặc nhập location mục tiêu trước khi scale."


def _policy_warnings(project, project_text: str) -> list[PolicyWarning]:
    warnings: list[PolicyWarning] = []
    for item in (getattr(project, "restricted_countries", None) or []):
        country = item.get("country", "")
        kind = item.get("restriction_type", "restricted")
        warnings.append(PolicyWarning(
            level="critical" if kind == "banned" else "warning",
            title=f"{country} {kind}",
            detail=_truncate("; ".join(item.get("signals") or []) or "Có tín hiệu hạn chế từ dữ liệu đã quét.", 180),
        ))
    sensitive_terms = ["casino", "bet", "forex", "crypto", "loan", "adult", "nsfw"]
    found = [term for term in sensitive_terms if term in project_text.lower()]
    if found:
        warnings.append(PolicyWarning(
            level="warning",
            title="Ngành hàng cần kiểm tra policy",
            detail=f"Phát hiện tín hiệu nhạy cảm: {', '.join(found)}. Cần rà soát Google Ads policy trước khi viết claim.",
        ))
    if not warnings:
        warnings.append(PolicyWarning(
            level="info",
            title="Chưa thấy cảnh báo lớn",
            detail="Không có restricted country hoặc term nhạy cảm rõ ràng trong dữ liệu đã quét.",
        ))
    return warnings[:8]


def _keyword_intent(keyword: str) -> str:
    text = keyword.lower()
    if any(token in text for token in ["review", "vs", "scam", "đánh giá"]):
        return "Research/so sánh"
    if any(token in text for token in ["bonus", "promo", "coupon", "mã", "login", "app", "download"]):
        return "Chuyển đổi cao"
    if any(token in text for token in ["buy", "mua", "price", "giá", "register", "sign up"]):
        return "Mua/đăng ký"
    return "Khám phá nhu cầu"


def _match_type(keyword: str, index: int) -> str:
    intent = _keyword_intent(keyword)
    if intent in {"Chuyển đổi cao", "Mua/đăng ký"} or index < 4:
        return "Exact"
    if index < 14:
        return "Phrase"
    return "Broad"


def _monthly_tail(row: KeywordPlannerResult) -> list[int]:
    rows = row.monthly_searches or []
    values = [int(item.get("searches") or 0) for item in rows if isinstance(item, dict)]
    return values[-3:]


def _strategy_keyword(
    keyword: str,
    source: str,
    index: int = 0,
    row: KeywordPlannerResult | None = None,
) -> StrategyKeyword:
    return StrategyKeyword(
        keyword=_clean(keyword),
        source=source,
        intent=_keyword_intent(keyword),
        match_type=_match_type(keyword, index),  # type: ignore[arg-type]
        avg_monthly_searches=row.avg_monthly_searches if row else None,
        competition=row.competition if row else None,
        low_top_page_bid=row.low_top_page_bid if row else None,
        high_top_page_bid=row.high_top_page_bid if row else None,
        last_3_month_searches=_monthly_tail(row) if row else [],
        note="Dữ liệu volume từ Google Keyword Planner." if row else "Keyword suy ra từ brand/đối thủ, cần quét volume để xác nhận.",
    )


def _build_keywords(domain: str, results: list[KeywordPlannerResult], brand_scan, competitors) -> list[StrategyKeyword]:
    output: list[StrategyKeyword] = []
    seen: set[str] = set()

    def add(item: StrategyKeyword) -> None:
        key = item.keyword.lower()
        if item.keyword and key not in seen:
            seen.add(key)
            output.append(item)

    for index, row in enumerate(results):
        add(_strategy_keyword(row.keyword, "Keyword Planner", index, row))

    brand = _brand_root(domain)
    for suffix in ["", "app", "login", "review", "bonus", "affiliate", "promo code"]:
        add(_strategy_keyword(f"{brand} {suffix}".strip(), "Brand seed", len(output)))

    for item in (getattr(brand_scan, "keywords", None) or [])[:12]:
        if isinstance(item, dict) and item.get("keyword"):
            add(_strategy_keyword(str(item["keyword"]), "SimilarWeb brand keyword", len(output)))

    for item in competitors[:12]:
        add(_strategy_keyword(item.keyword, "Saved Search Ads competitor", len(output)))

    return output[:40]


def _customer_segments(domain: str, project, keywords: list[StrategyKeyword]) -> list[CustomerSegment]:
    offer = _clean(getattr(project, "sale_content", None) or getattr(project, "event_content", None))
    top_keyword = keywords[0].keyword if keywords else _brand_root(domain)
    return [
        CustomerSegment(
            name="Nhóm đã biết brand",
            demographics="Người đã tìm tên brand/domain, thường đang ở cuối phễu.",
            pain_points=["Cần xác nhận độ uy tín", "Muốn vào đúng trang/offer nhanh"],
            needs=["Thông tin rõ ràng", "Đường dẫn chính xác", "Lý do đăng ký ngay"],
            messaging_angle=f"Nhấn vào độ tin cậy, truy cập nhanh và offer hiện có{': ' + offer if offer else ''}.",
        ),
        CustomerSegment(
            name="Nhóm đang so sánh giải pháp",
            demographics="Người tìm review, bonus, app, tính năng hoặc lựa chọn thay thế.",
            pain_points=["Sợ chọn sai nền tảng", "Không biết khác biệt so với đối thủ"],
            needs=["Bằng chứng lợi ích", "Thông điệp so sánh dễ hiểu", "Rào cản thấp để thử"],
            messaging_angle=f"Dùng keyword '{top_keyword}' làm cửa vào, nêu USP và lợi ích thực tế.",
        ),
        CustomerSegment(
            name="Nhóm có nhu cầu chuyển đổi",
            demographics="Người tìm đăng ký, mã khuyến mãi, bonus, tải app hoặc login.",
            pain_points=["Không thấy ưu đãi rõ", "Quy trình đăng ký rườm rà", "Lo ngại phí/điều kiện"],
            needs=["CTA trực tiếp", "Điều kiện minh bạch", "Ưu đãi nổi bật"],
            messaging_angle="Viết quảng cáo ngắn, rõ offer, gắn sitelink tới đăng ký/khuyến mãi/hỗ trợ.",
        ),
    ]


def _ad_groups(keywords: list[StrategyKeyword]) -> list[AdGroupPlan]:
    groups = [
        ("Brand Core", "Bắt nhu cầu tìm trực tiếp thương hiệu", lambda k: k.source.startswith("Brand") or k.intent == "Chuyển đổi cao"),
        ("Review & Trust", "Bắt người đang kiểm tra uy tín hoặc so sánh", lambda k: "review" in k.keyword.lower() or k.intent == "Research/so sánh"),
        ("Expansion", "Mở rộng các truy vấn liên quan sau khi nhóm core có dữ liệu", lambda k: True),
    ]
    output: list[AdGroupPlan] = []
    used: set[str] = set()
    for name, objective, predicate in groups:
        rows = [k for k in keywords if k.keyword not in used and predicate(k)][:8]
        for row in rows:
            used.add(row.keyword)
        output.append(AdGroupPlan(
            name=name,
            objective=objective,
            keywords=rows,
            rationale=f"Nhóm này tách intent để dễ kiểm soát bid, CTR và CPA thay vì trộn mọi keyword vào một ad group.",
        ))
    return output


def _rsa_copy(link: AffiliateLink, project, keywords: list[StrategyKeyword]) -> RsaCopy:
    brand = _truncate(getattr(project, "project_name", None) or _brand_root(link.domain).title(), 18)
    offer = _clean(getattr(project, "sale_content", None) or getattr(project, "event_content", None))
    top_kw = keywords[0].keyword if keywords else brand
    headlines = _dedupe([
        brand,
        f"{brand} Official",
        f"{brand} Bonus",
        f"{brand} App",
        f"{brand} Review",
        f"{brand} Login",
        f"Try {brand} Today",
        "Fast Sign Up",
        "Secure Platform",
        "Get Started Online",
        "Exclusive Offer",
        "Compare Benefits",
        "Join In Minutes",
        "Mobile Friendly",
        _truncate(top_kw.title(), 30),
    ])
    descriptions = _dedupe([
        f"Explore {brand} with clear benefits, fast access and a focused offer.",
        offer or f"Start from the best-matched keyword: {top_kw}. Check details before signup.",
        "Use Search Ads to test high-intent traffic first, then scale winning keywords.",
        "Review features, offer details and support before making your decision.",
    ])
    callouts = _dedupe(["Fast Sign Up", "Mobile Friendly", "Clear Offer", "Support Available"])
    return RsaCopy(
        headlines=[_truncate(item, 30) for item in headlines[:15]],
        descriptions=[_truncate(item, 90) for item in descriptions[:4]],
        callouts=[_truncate(item, 25) for item in callouts[:4]],
        sitelinks=[
            Sitelink(title="Promotions", description_1="See latest offer", description_2="Check terms first", url=link.affiliate_url),
            Sitelink(title="How It Works", description_1="Review key features", description_2="Start with clarity", url=link.affiliate_url),
            Sitelink(title="Mobile App", description_1="Access on mobile", description_2="Fast setup flow", url=link.affiliate_url),
            Sitelink(title="Support", description_1="Get help quickly", description_2="Ask before signup", url=link.affiliate_url),
        ],
    )


def _budget_plan(payload: AdsStrategyRequest, keywords: list[StrategyKeyword], project, traffic) -> BudgetPlan:
    budget = float(payload.budget)
    days = int(payload.duration_days)
    daily = budget / days if days else budget
    has_cpc = any(item.high_top_page_bid for item in keywords)
    has_offer = bool(getattr(project, "sale_content", None) or getattr(project, "event_content", None))
    visits = getattr(traffic, "monthly_visits", 0) if traffic else 0
    recommendation = (
        f"Chạy test {days} ngày với khoảng {daily:.2f} {payload.currency}/ngày; ưu tiên exact/phrase cho nhóm Brand Core."
        if has_cpc and has_offer and visits
        else f"Chạy test thận trọng {days} ngày với {daily:.2f} {payload.currency}/ngày vì dữ liệu chưa đủ dày."
    )
    return BudgetPlan(
        total_budget=budget,
        duration_days=days,
        daily_budget=daily,
        currency=payload.currency.upper(),
        recommendation=recommendation,
        allocations=[
            BudgetAllocation(label="Brand Core", percent=55, amount=budget * 0.55, rationale="Bắt intent nóng nhất, dễ đo CTR/CVR."),
            BudgetAllocation(label="Review & Trust", percent=25, amount=budget * 0.25, rationale="Kiểm tra nhóm đang so sánh và cần niềm tin."),
            BudgetAllocation(label="Optimization Reserve", percent=20, amount=budget * 0.2, rationale="Dồn cho keyword/ad group có tín hiệu tốt sau 48-72 giờ."),
        ],
    )


def _data_notes(traffic, project, keyword_results, competitors, histories) -> list[str]:
    notes = []
    if traffic:
        notes.append("Có dữ liệu traffic/country từ SimilarWeb scan.")
    else:
        notes.append("Chưa có traffic scan; geo recommendation có độ tin cậy thấp.")
    if project:
        notes.append("Có project scan để suy luận sản phẩm, offer và restriction.")
    else:
        notes.append("Chưa có project scan; product summary/RSA đang dựa nhiều vào domain.")
    if keyword_results:
        notes.append("Keyword volume/CPC lấy từ Google Keyword Planner đã lưu.")
    else:
        notes.append("Chưa có Keyword Planner result khớp project; keyword volume đang thiếu.")
    if competitors or histories:
        notes.append("Có dữ liệu đối thủ từ Search Ads đã lưu.")
    else:
        notes.append("Chưa có đối thủ Search Ads khớp domain/brand.")
    return notes


def _data_confidence(notes: list[str]) -> str:
    good = sum(1 for note in notes if note.startswith("Có "))
    if good >= 3:
        return "high"
    if good >= 2:
        return "medium"
    return "low"
