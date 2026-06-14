from __future__ import annotations

import re
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.api.affiliate_data.repository import AffiliateDataRepository
from app.shared.services import scan_traffic, tavily_search

_PRIORITY_LINK_KEYWORDS = (
    "affiliate",
    "partner",
    "program",
    "referral",
    "commission",
    "terms",
    "promotion",
    "sale",
)

_COUNTRY_ALIASES: dict[str, tuple[str, ...]] = {
    "United States": ("united states", "usa", "us", "u.s."),
    "United Kingdom": ("united kingdom", "uk", "u.k.", "britain"),
    "Vietnam": ("vietnam", "viet nam", "vn"),
    "Singapore": ("singapore", "sg"),
    "Japan": ("japan", "jp"),
    "South Korea": ("south korea", "korea", "kr"),
    "Germany": ("germany", "de"),
    "France": ("france", "fr"),
    "Spain": ("spain", "es"),
    "Italy": ("italy", "it"),
    "Netherlands": ("netherlands", "nl"),
    "Canada": ("canada", "ca"),
    "Australia": ("australia", "au"),
    "India": ("india", "in"),
    "Indonesia": ("indonesia", "id"),
    "Thailand": ("thailand", "th"),
    "Malaysia": ("malaysia", "my"),
    "Philippines": ("philippines", "ph"),
    "Brazil": ("brazil", "br"),
    "Mexico": ("mexico", "mx"),
}

_RESTRICTION_KEYWORDS = (
    "banned",
    "prohibited",
    "not allowed",
    "not accepted",
    "not available",
    "unable to offer",
    "do not extend our services",
    "cease operations",
    "unavailable",
    "excluded",
    "blocked",
    "restricted",
    "cannot participate",
    "cannot purchase",
    "ineligible",
)

_BANNED_KEYWORDS = (
    "banned",
    "prohibited",
    "not allowed",
    "not accepted",
    "blocked",
)

_CC_TLD_TO_COUNTRY = {
    "us": "United States",
    "uk": "United Kingdom",
    "vn": "Vietnam",
    "sg": "Singapore",
    "jp": "Japan",
    "kr": "South Korea",
    "de": "Germany",
    "fr": "France",
    "es": "Spain",
    "it": "Italy",
    "nl": "Netherlands",
    "ca": "Canada",
    "au": "Australia",
    "in": "India",
    "id": "Indonesia",
    "th": "Thailand",
    "my": "Malaysia",
    "ph": "Philippines",
    "br": "Brazil",
    "mx": "Mexico",
}


def extract_domain(website: str) -> str:
    value = website.strip()
    if not value:
        raise ValueError("Website không được để trống")

    normalized = value if value.startswith(("http://", "https://")) else f"https://{value}"
    parsed = urlparse(normalized)
    domain = (parsed.netloc or parsed.path).lower().strip()
    if domain.startswith("www."):
        domain = domain[4:]
    domain = domain.split("/")[0]
    if not domain or "." not in domain:
        raise ValueError("Không thể xác định domain hợp lệ từ website cung cấp")
    return domain


def normalize_affiliate_url(website: str) -> str:
    value = website.strip()
    if not value:
        raise ValueError("Website không được để trống")
    normalized = value if value.startswith(("http://", "https://")) else f"https://{value}"
    parsed = urlparse(normalized)
    host = (parsed.netloc or parsed.path).strip().lower()
    path = parsed.path if parsed.netloc else ""
    if not host or "." not in host:
        raise ValueError("Không thể xác định domain hợp lệ từ website cung cấp")
    rebuilt = f"https://{host}{path}".rstrip("/")
    return rebuilt


def _pick_best_result(results: list[dict]) -> dict | None:
    if not results:
        return None

    def _score(item: dict) -> tuple[int, float]:
        url = str(item.get("url") or "").lower()
        keyword_score = sum(2 for k in _PRIORITY_LINK_KEYWORDS if k in url)
        raw_score = item.get("score")
        numeric_score = float(raw_score) if isinstance(raw_score, (int, float)) else 0.0
        return keyword_score, numeric_score

    return max(results, key=_score)


def _extract_project_name_from_title(title: str | None, domain: str) -> str | None:
    if not title:
        return None

    parts = [p.strip() for p in re.split(r"\s[\-|\|:]\s", title) if p.strip()]
    if not parts:
        return None

    banned = {"affiliate", "program", "commission", "referral", "terms", domain}
    for part in parts:
        lowered = part.lower()
        if any(token in lowered for token in banned):
            continue
        return part

    return parts[0]


def _extract_sentence(text: str, keywords: tuple[str, ...]) -> str | None:
    if not text:
        return None

    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return None

    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    for sentence in sentences:
        lowered = sentence.lower()
        if any(keyword in lowered for keyword in keywords):
            return sentence[:500]

    lowered = cleaned.lower()
    if any(keyword in lowered for keyword in keywords):
        return cleaned[:500]

    return None


def _build_country_signals(results: list[dict], answer: str | None) -> list[dict]:
    signal_map: dict[str, dict[str, object]] = {}

    def add_signal(country: str, signal: str, weight: int) -> None:
        bucket = signal_map.setdefault(country, {"signal_score": 0, "signals": []})
        bucket["signal_score"] = int(bucket["signal_score"]) + weight
        signals = bucket["signals"]
        if isinstance(signals, list) and signal not in signals:
            signals.append(signal)

    combined_text = "\n".join(
        filter(
            None,
            [
                str(answer or ""),
                *(str(item.get("title") or "") for item in results),
                *(str(item.get("content") or "") for item in results),
                *(str(item.get("raw_content") or "") for item in results),
            ],
        )
    ).lower()

    for country, aliases in _COUNTRY_ALIASES.items():
        for alias in aliases:
            pattern = rf"\b{re.escape(alias.lower())}\b"
            if re.search(pattern, combined_text):
                add_signal(country, f"text:{alias}", 2)

    for item in results:
        url = str(item.get("url") or "").lower()
        tld_match = re.search(r"\.([a-z]{2})(?:/|$)", url)
        if tld_match:
            cc = tld_match.group(1)
            country = _CC_TLD_TO_COUNTRY.get(cc)
            if country:
                add_signal(country, f"ccTLD:.{cc}", 3)

    for lang_country in re.findall(r"hreflang\s*=\s*[\"']([a-z]{2})-([a-z]{2})[\"']", combined_text):
        cc = lang_country[1].lower()
        country = _CC_TLD_TO_COUNTRY.get(cc)
        if country:
            add_signal(country, f"hreflang:{lang_country[0]}-{lang_country[1]}", 3)

    hq_sentences = re.split(r"(?<=[.!?])\s+", combined_text)
    hq_keywords = ("headquarter", "head office", "based in", "branch", "office in")
    for sentence in hq_sentences:
        if not any(k in sentence for k in hq_keywords):
            continue
        for country, aliases in _COUNTRY_ALIASES.items():
            if any(re.search(rf"\b{re.escape(alias.lower())}\b", sentence) for alias in aliases):
                add_signal(country, "hq_or_branch_mention", 4)

    ranked = sorted(
        (
            {
                "country": country,
                "signal_score": int(payload["signal_score"]),
                "signals": list(payload["signals"]),
            }
            for country, payload in signal_map.items()
        ),
        key=lambda item: (item["signal_score"], len(item["signals"])),
        reverse=True,
    )
    return ranked[:5]


def _snippet_around(text: str, needle: str, max_chars: int = 300) -> str:
    lowered = text.lower()
    index = lowered.find(needle.lower())
    if index < 0:
        return re.sub(r"\s+", " ", text).strip()[:max_chars]
    start = max(0, index - max_chars // 2)
    end = min(len(text), index + max_chars // 2)
    return re.sub(r"\s+", " ", text[start:end]).strip()


def _split_restriction_contexts(text: str) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    if not cleaned:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    if len(sentences) <= 1:
        return [cleaned[:700]]
    return [sentence[:700] for sentence in sentences if sentence.strip()]


def _build_restricted_country_insights(results: list[dict], answer: str | None) -> list[dict]:
    buckets: dict[str, dict[str, object]] = {}

    def add_context(country: str, context: str, result: dict | None) -> None:
        lowered = context.lower()
        hard = any(keyword in lowered for keyword in _BANNED_KEYWORDS)
        bucket = buckets.setdefault(
            country,
            {
                "country": country,
                "restriction_type": "restricted",
                "signals": [],
                "evidence_links": [],
                "confidence": "low",
                "verification_note": (
                    "Kết quả này được suy luận tự động từ dữ liệu web. "
                    "Hãy mở nguồn để kiểm tra Terms, eligibility hoặc restricted jurisdictions."
                ),
            },
        )
        if hard:
            bucket["restriction_type"] = "banned"

        signals = bucket["signals"]
        if isinstance(signals, list):
            snippet = context[:500]
            if snippet not in signals:
                signals.append(snippet)

        url = str(result.get("url") or "") if result else ""
        if url:
            evidence_links = bucket["evidence_links"]
            if isinstance(evidence_links, list) and all(link.get("url") != url for link in evidence_links):
                evidence_links.append(
                    {
                        "title": result.get("title"),
                        "url": url,
                        "snippet": _snippet_around(context, country),
                    }
                )
            bucket["confidence"] = "medium"

    sources: list[tuple[str, dict | None]] = []
    if answer:
        sources.append((answer, None))
    for result in results:
        sources.extend(
            (
                (str(result.get("title") or ""), result),
                (str(result.get("content") or ""), result),
                (str(result.get("raw_content") or ""), result),
            )
        )

    for text, result in sources:
        for context in _split_restriction_contexts(text):
            lowered = context.lower()
            if not any(keyword in lowered for keyword in _RESTRICTION_KEYWORDS):
                continue
            for country, aliases in _COUNTRY_ALIASES.items():
                if any(re.search(rf"\b{re.escape(alias.lower())}\b", lowered) for alias in aliases):
                    add_context(country, context, result)

    ranked = sorted(
        buckets.values(),
        key=lambda item: (
            1 if item.get("restriction_type") == "banned" else 0,
            len(item.get("evidence_links") or []),
            len(item.get("signals") or []),
        ),
        reverse=True,
    )
    for item in ranked:
        if isinstance(item.get("evidence_links"), list):
            item["evidence_links"] = item["evidence_links"][:3]
        if isinstance(item.get("signals"), list):
            item["signals"] = item["signals"][:4]
    return ranked


async def scan_affiliate_project_insights(
    website: str,
    max_results: int,
    search_depth: str,
    include_raw_content: bool,
) -> dict:
    domain = extract_domain(website)

    query = " ".join(
        [
            domain,
            "official product features pricing affiliate program commission payout referral terms",
            "campaign sale promotion offer headquarters countries restricted unavailable regions",
        ]
    )

    data = await tavily_search(
        query=query,
        search_depth=search_depth,
        topic="general",
        max_results=max_results,
        include_answer=True,
        include_raw_content=include_raw_content,
        include_domains=[domain],
    )

    results = data.get("results") or []
    best = _pick_best_result(results)

    project_link = str(best.get("url")) if best and best.get("url") else None
    project_name = _extract_project_name_from_title(
        str(best.get("title")) if best and best.get("title") else None,
        domain,
    )

    combined_text = "\n".join(
        filter(
            None,
            [
                str(data.get("answer") or ""),
                *(str(item.get("content") or "") for item in results),
                *(str(item.get("raw_content") or "") for item in results),
            ],
        )
    )

    event_content = _extract_sentence(
        combined_text,
        ("event", "campaign", "launch", "webinar", "conference", "promotion"),
    )
    sale_content = _extract_sentence(
        combined_text,
        ("sale", "discount", "coupon", "offer", "deal", "%", "off"),
    )

    top_countries = _build_country_signals(results, data.get("answer"))
    restricted_countries = _build_restricted_country_insights(results, data.get("answer"))

    return {
        "website": website,
        "domain": domain,
        "project_name": project_name,
        "project_link": project_link,
        "event_content": event_content,
        "sale_content": sale_content,
        "restricted_countries": restricted_countries,
        "top_countries": top_countries,
        "query": data.get("query", query),
        "answer": data.get("answer"),
        "results": results,
    }


class AffiliateDataService:
    def __init__(self, db: Session) -> None:
        self.repository = AffiliateDataRepository(db)

    def create_affiliate_link(self, user_id: str, website: str) -> dict:
        normalized_url = normalize_affiliate_url(website)
        domain = extract_domain(normalized_url)

        row = self.repository.get_or_create_affiliate_link(
            user_id=user_id,
            affiliate_url=normalized_url,
            domain=domain,
        )
        self.repository.commit()

        return {
            "id": row.id,
            "user_id": row.user_id,
            "affiliate_url": row.affiliate_url,
            "domain": row.domain,
            "raw_data": row.raw_data,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }

    async def create_traffic_scan(
        self,
        user_id: str,
        affiliate_link_id: str,
        months: int,
        start_period: str | None = None,
    ) -> dict:
        link = self.repository.get_affiliate_link_by_id_for_user(
            user_id=user_id,
            affiliate_link_id=affiliate_link_id,
        )
        if not link:
            raise ValueError("Affiliate link không tồn tại hoặc không thuộc user hiện tại")

        traffic_result = await scan_traffic(
            link.affiliate_url,
            months=months,
            start_period=start_period,
        )
        traffic_result["url"] = link.affiliate_url
        traffic_result["domain"] = link.domain

        self.repository.create_traffic_scan(
            affiliate_link_id=link.id,
            traffic_result=traffic_result,
        )
        self.repository.commit()
        return traffic_result

    async def create_project_scan(
        self,
        user_id: str,
        affiliate_link_id: str,
        max_results: int,
        search_depth: str,
        include_raw_content: bool,
    ) -> dict:
        link = self.repository.get_affiliate_link_by_id_for_user(
            user_id=user_id,
            affiliate_link_id=affiliate_link_id,
        )
        if not link:
            raise ValueError("Affiliate link không tồn tại hoặc không thuộc user hiện tại")

        project_result = await scan_affiliate_project_insights(
            website=link.affiliate_url,
            max_results=max_results,
            search_depth=search_depth,
            include_raw_content=include_raw_content,
        )

        self.repository.create_project_data_scan(
            affiliate_link_id=link.id,
            project_result=project_result,
        )
        self.repository.commit()
        return project_result

    def get_all_affiliate_links(self, user_id: str) -> list[dict]:
        rows = self.repository.get_all_affiliate_links_for_user(user_id)
        return [
            {
                "id": row.id,
                "user_id": row.user_id,
                "affiliate_url": row.affiliate_url,
                "domain": row.domain,
                "raw_data": row.raw_data,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
            for row in rows
        ]

    def delete_affiliate_link(self, user_id: str, affiliate_link_id: str) -> None:
        deleted = self.repository.delete_affiliate_link_for_user(
            user_id=user_id,
            affiliate_link_id=affiliate_link_id,
        )
        if not deleted:
            raise ValueError("Affiliate link không tồn tại hoặc không thuộc user hiện tại")
        self.repository.commit()

    def get_affiliate_link_detail_by_user(self, user_id: str, website: str) -> dict | None:
        normalized_url = normalize_affiliate_url(website)
        row = self.repository.get_affiliate_link_detail_by_user(
            user_id=user_id,
            affiliate_url=normalized_url,
        )
        if not row:
            return None

        traffic_scans = sorted(
            row.traffic_scans,
            key=lambda item: item.created_at,
            reverse=True,
        )
        project_data_scans = sorted(
            row.project_data_scans,
            key=lambda item: item.created_at,
            reverse=True,
        )

        return {
            "affiliate_link": {
                "id": row.id,
                "user_id": row.user_id,
                "affiliate_url": row.affiliate_url,
                "domain": row.domain,
                "raw_data": row.raw_data,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            },
            "traffic_scans": [
                {
                    "id": item.id,
                    "affiliate_link_id": item.affiliate_link_id,
                    "found": item.found,
                    "monthly_visits": item.monthly_visits,
                    "period_month": item.period_month,
                    "traffic_details": item.traffic_details,
                    "raw_data": item.raw_data,
                    "created_at": item.created_at,
                    "updated_at": item.updated_at,
                }
                for item in traffic_scans
            ],
            "project_data_scans": [
                {
                    "id": item.id,
                    "affiliate_link_id": item.affiliate_link_id,
                    "query": item.query,
                    "project_name": item.project_name,
                    "project_link": item.project_link,
                    "event_content": item.event_content,
                    "sale_content": item.sale_content,
                    "restricted_countries": item.restricted_countries or [],
                    "top_countries": item.top_countries or [],
                    "answer": item.answer,
                    "results": item.results or [],
                    "raw_data": item.raw_data,
                    "created_at": item.created_at,
                    "updated_at": item.updated_at,
                }
                for item in project_data_scans
            ],
        }
