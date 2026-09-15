"""Quét Keyword Planner theo từng mảng để tìm dự án affiliate tiềm năng.

Chạy trực tiếp qua Google Ads API thay vì thao tác trên giao diện Keyword Planner,
vì API cho phép chia nhỏ truy vấn và retry khi Google trả DEADLINE_EXCEEDED.

Tiêu chí lọc mặc định (theo yêu cầu nghiên cứu ngày 2026-08-12):
    - avg_monthly_searches >= 5000
    - low_top_page_bid  < 1.0 USD
    - high_top_page_bid >= 5.0 USD

Cách dùng (từ thư mục server/):
    .venv\\Scripts\\python.exe scripts\\affiliate_keyword_scan.py
    .venv\\Scripts\\python.exe scripts\\affiliate_keyword_scan.py --verticals forex hosting
    .venv\\Scripts\\python.exe scripts\\affiliate_keyword_scan.py --list
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from sqlalchemy import text  # noqa: E402

from app.api.keyword_planner.classification import classify_intent  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.shared.services.google_ads import get_keyword_ideas  # noqa: E402

REPO_ROOT = SERVER_ROOT.parent
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "research" / "affiliate-keyword-scan.csv"

MIN_SEARCHES = 5_000
MAX_LOW_BID = 1.0
MIN_HIGH_BID = 5.0

LANGUAGE_ENGLISH = 1000
ALL_LOCATIONS: list[int] = []

# Google timeout khi seed quá rộng, nên mỗi nhóm chỉ 1-3 seed hẹp.
SEED_GROUPS: dict[str, list[list[str]]] = {
    # --- Sản phẩm số / dịch vụ ---
    "forex": [["forex trading platform"], ["forex broker"], ["cfd trading"]],
    "crypto": [["crypto exchange"], ["bitcoin trading app"]],
    "hosting": [["web hosting"], ["vps hosting"], ["domain registration"]],
    "vpn": [["vpn service"], ["best vpn"]],
    "ai_tools": [["ai writing tool"], ["ai image generator"], ["ai chatbot software"]],
    "saas_crm": [["crm software"], ["email marketing software"]],
    "saas_design": [["website builder"], ["graphic design software"]],
    "education": [["online course platform"], ["language learning app"]],
    "finance": [["personal loan"], ["credit card offers"], ["online banking app"]],
    "insurance": [["car insurance quotes"], ["travel insurance"]],
    # --- Sản phẩm vật lý ---
    "electronics": [["wireless earbuds"], ["gaming laptop"], ["robot vacuum"]],
    "home_kitchen": [["espresso machine"], ["air fryer"], ["mattress"]],
    "beauty": [["skin care products"], ["hair dryer"], ["perfume"]],
    "health_sports": [["running shoes"], ["protein powder"], ["home gym equipment"]],
    "fashion": [["mens watches"], ["handbags"], ["sunglasses"]],
    "baby": [["baby stroller"], ["diapers"]],
    "pets": [["dog food"], ["cat litter box"]],
    "auto": [["car accessories"], ["dash cam"]],
    "diy_garden": [["power tools"], ["lawn mower"]],
}

RETRY_DELAYS = (5, 15, 40)


def load_refresh_token(mail_email: str | None) -> tuple[str, str]:
    """Trả về (refresh_token, email) của mail đã ủy quyền."""
    query = """
        SELECT dm.email, ag.refresh_token
        FROM author_gmails ag
        JOIN delegated_mails dm ON dm.id = ag.mail_id
        WHERE ag.refresh_token IS NOT NULL AND ag.refresh_token <> ''
    """
    params: dict[str, str] = {}
    if mail_email:
        query += " AND dm.email = :email"
        params["email"] = mail_email
    query += " ORDER BY ag.updated_at DESC LIMIT 1"

    with SessionLocal() as db:
        row = db.execute(text(query), params).first()

    if row is None:
        raise SystemExit(
            "Không tìm thấy refresh_token nào trong author_gmails. "
            "Hãy ủy quyền mail qua Mail Delegation trước khi quét."
        )
    return row.refresh_token, row.email


def pick_customer_id(explicit: str | None) -> tuple[str, str]:
    """Chọn tài khoản Ads đang hoạt động (bỏ qua tài khoản suspended)."""
    if explicit:
        return explicit.replace("-", ""), explicit

    with SessionLocal() as db:
        row = db.execute(
            text(
                """
                SELECT ads_id, ads_name
                FROM ads_accounts
                WHERE ads_status = 'enabled'
                ORDER BY ads_name DESC
                LIMIT 1
                """
            )
        ).first()

    if row is None:
        raise SystemExit(
            "Không có tài khoản Ads nào ở trạng thái enabled. "
            "Tài khoản bị suspended sẽ không gọi được Keyword Planner."
        )
    return row.ads_id.replace("-", ""), row.ads_name


def fetch_with_retry(seeds: list[str], refresh_token: str, customer_id: str, limit: int) -> list[dict]:
    """Gọi Keyword Planner, retry khi Google trả DEADLINE_EXCEEDED / UNAVAILABLE."""
    last_error: Exception | None = None
    for attempt, delay in enumerate((0, *RETRY_DELAYS)):
        if delay:
            print(f"      retry sau {delay}s (lần {attempt}/{len(RETRY_DELAYS)})...")
            time.sleep(delay)
        try:
            return get_keyword_ideas(
                keywords=seeds,
                refresh_token=refresh_token,
                customer_id=customer_id,
                language_id=LANGUAGE_ENGLISH,
                location_ids=ALL_LOCATIONS,
                limit=limit,
            )
        except Exception as exc:  # noqa: BLE001 - cần đọc mã lỗi dạng chuỗi từ google-ads
            message = str(exc)
            retryable = "DEADLINE_EXCEEDED" in message or "UNAVAILABLE" in message
            last_error = exc
            if not retryable:
                raise
    raise RuntimeError(f"Hết lượt retry cho seed {seeds}: {last_error}")


def passes_filter(idea: dict) -> bool:
    low = idea.get("low_top_page_bid")
    high = idea.get("high_top_page_bid")
    if low is None or high is None:
        return False
    return (
        int(idea.get("avg_monthly_searches") or 0) >= MIN_SEARCHES
        and float(low) < MAX_LOW_BID
        and float(high) >= MIN_HIGH_BID
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verticals", nargs="*", help="Chỉ quét các mảng chỉ định.")
    parser.add_argument("--mail", help="Email đã ủy quyền (mặc định: mail mới nhất).")
    parser.add_argument("--ads-id", help="Customer ID Google Ads (mặc định: account enabled).")
    parser.add_argument("--limit", type=int, default=300, help="Số ý tưởng tối đa mỗi seed.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="File CSV kết quả.")
    parser.add_argument("--list", action="store_true", help="Chỉ liệt kê các mảng có sẵn.")
    args = parser.parse_args()

    if args.list:
        for name, groups in SEED_GROUPS.items():
            seeds = ", ".join(seed for group in groups for seed in group)
            print(f"{name:<15} {seeds}")
        return 0

    verticals = args.verticals or list(SEED_GROUPS)
    unknown = [name for name in verticals if name not in SEED_GROUPS]
    if unknown:
        raise SystemExit(f"Mảng không tồn tại: {', '.join(unknown)}. Dùng --list để xem danh sách.")

    refresh_token, mail_email = load_refresh_token(args.mail)
    customer_id, account_label = pick_customer_id(args.ads_id)
    print(f"Mail   : {mail_email}")
    print(f"Account: {account_label} ({customer_id})")
    print(f"Bộ lọc : searches >= {MIN_SEARCHES}, low bid < ${MAX_LOW_BID}, high bid >= ${MIN_HIGH_BID}")
    print(f"Mảng   : {', '.join(verticals)}\n")

    rows: list[dict] = []
    seen: set[tuple[str, str]] = set()
    failed: list[str] = []

    for vertical in verticals:
        print(f"[{vertical}]")
        for group in SEED_GROUPS[vertical]:
            label = " + ".join(group)
            try:
                ideas = fetch_with_retry(group, refresh_token, customer_id, args.limit)
            except Exception as exc:  # noqa: BLE001
                print(f"   x {label}: {type(exc).__name__} — bỏ qua")
                failed.append(f"{vertical}:{label}")
                continue

            kept = 0
            for idea in ideas:
                if not passes_filter(idea):
                    continue
                key = (vertical, idea["keyword"])
                if key in seen:
                    continue
                seen.add(key)
                kept += 1
                rows.append(
                    {
                        "vertical": vertical,
                        "seed": label,
                        "keyword": idea["keyword"],
                        "avg_monthly_searches": idea["avg_monthly_searches"],
                        "competition": idea["competition"],
                        "competition_index": idea.get("competition_index"),
                        "low_top_page_bid": round(float(idea["low_top_page_bid"]), 2),
                        "high_top_page_bid": round(float(idea["high_top_page_bid"]), 2),
                        "intent": classify_intent(idea["keyword"]),
                        "affiliate_program": "",
                        "affiliate_note": "",
                    }
                )
            print(f"   - {label}: {len(ideas)} ý tưởng -> {kept} đạt chuẩn")

    rows.sort(key=lambda r: (r["vertical"], -int(r["avg_monthly_searches"])))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]) if rows else ["vertical", "keyword"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nTổng: {len(rows)} từ khóa đạt chuẩn -> {args.output}")
    if failed:
        print(f"Seed lỗi (chưa có dữ liệu): {', '.join(failed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
