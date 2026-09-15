"""Tra Keyword Planner theo tên dự án và xuất bảng dự án affiliate.

Quy trình: danh sách dự án (tên + domain) thu thập từ tìm kiếm web nằm trong
`docs/research/affiliate-projects-seed.json`; script gửi tên dự án làm seed keyword
tới Keyword Planner, lấy đúng dòng khớp tên dự án rồi ghi ra bảng:

    tên dự án | domain dự án | chi phí đầu trang | chi phí thấp nhất

Kèm hai cột phụ trợ: mảng và lượt tìm kiếm/tháng, để biết dự án nào đủ lưu lượng.

Cách dùng (từ thư mục server/):
    .venv\\Scripts\\python.exe scripts\\affiliate_project_table.py
    .venv\\Scripts\\python.exe scripts\\affiliate_project_table.py --verticals forex hosting
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from affiliate_keyword_scan import (  # noqa: E402
    ALL_LOCATIONS,
    LANGUAGE_ENGLISH,
    RETRY_DELAYS,
    load_refresh_token,
    pick_customer_id,
)
from app.shared.services.google_ads import get_keyword_ideas  # noqa: E402

REPO_ROOT = SERVER_ROOT.parent
DEFAULT_SEED = REPO_ROOT / "docs" / "research" / "affiliate-projects-seed.json"
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "research" / "affiliate-projects-table.csv"

# Mỗi request gửi nhiều tên dự án cùng lúc; quá rộng thì Google timeout.
BATCH_SIZE = 5


def normalize(text: str) -> str:
    """Chuẩn hóa để so khớp tên dự án với keyword Google trả về."""
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()


def fetch_with_retry(seeds: list[str], refresh_token: str, customer_id: str) -> list[dict]:
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
                limit=None,
            )
        except Exception as exc:  # noqa: BLE001 - google-ads trả lỗi dạng chuỗi
            message = str(exc)
            if "DEADLINE_EXCEEDED" not in message and "UNAVAILABLE" not in message:
                raise
            last_error = exc
    raise RuntimeError(f"Hết lượt retry cho batch {seeds}: {last_error}")


def money(value: object) -> str:
    return "" if value is None else f"{float(value):.2f}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verticals", nargs="*", help="Chỉ tra các mảng chỉ định.")
    parser.add_argument("--mail", help="Email đã ủy quyền (mặc định: mail mới nhất).")
    parser.add_argument("--ads-id", help="Customer ID Google Ads (mặc định: account enabled).")
    parser.add_argument("--seed-file", type=Path, default=DEFAULT_SEED)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    catalog = json.loads(args.seed_file.read_text(encoding="utf-8"))
    catalog.pop("_meta", None)

    verticals = args.verticals or list(catalog)
    unknown = [name for name in verticals if name not in catalog]
    if unknown:
        raise SystemExit(f"Mảng không tồn tại trong seed file: {', '.join(unknown)}")

    refresh_token, mail_email = load_refresh_token(args.mail)
    customer_id, account_label = pick_customer_id(args.ads_id)
    total_projects = sum(len(catalog[v]) for v in verticals)
    print(f"Mail   : {mail_email}")
    print(f"Account: {account_label} ({customer_id})")
    print(f"Tra    : {total_projects} dự án / {len(verticals)} mảng\n")

    rows: list[dict] = []
    missing: list[str] = []

    for vertical in verticals:
        projects = catalog[vertical]
        print(f"[{vertical}] {len(projects)} dự án")

        for start in range(0, len(projects), BATCH_SIZE):
            batch = projects[start : start + BATCH_SIZE]
            # Tên quá chung (vd "ig") phải tra bằng cụm rõ nghĩa khai báo ở trường "query".
            names = [item.get("query") or item["name"] for item in batch]
            try:
                ideas = fetch_with_retry(names, refresh_token, customer_id)
            except Exception as exc:  # noqa: BLE001
                print(f"   x batch {names}: {type(exc).__name__} — bỏ qua")
                missing.extend(f"{vertical}:{name}" for name in names)
                continue

            # Google trả nhiều dòng cùng chuẩn hóa về một tên (khác hoa thường, dấu câu).
            # Giữ dòng có volume lớn nhất, nếu không sẽ nhận nhầm biến thể gần như không ai tìm.
            index: dict[str, dict] = {}
            for idea in ideas:
                key = normalize(idea["keyword"])
                current = index.get(key)
                if current is None or idea["avg_monthly_searches"] > current["avg_monthly_searches"]:
                    index[key] = idea

            for item in batch:
                idea = index.get(normalize(item.get("query") or item["name"]))
                if idea is None:
                    print(f"   ? {item['name']}: Google không trả dòng khớp tên")
                    missing.append(f"{vertical}:{item['name']}")
                    continue
                rows.append(
                    {
                        "mảng": vertical,
                        "tên dự án": item["name"],
                        "domain dự án": item["domain"],
                        "lượt tìm kiếm/tháng": idea["avg_monthly_searches"],
                        "chi phí đầu trang (USD)": money(idea.get("high_top_page_bid")),
                        "chi phí thấp nhất (USD)": money(idea.get("low_top_page_bid")),
                        "cạnh tranh": idea["competition"],
                    }
                )
            done = min(start + BATCH_SIZE, len(projects))
            print(f"   - {done}/{len(projects)}")

    rows.sort(key=lambda r: (r["mảng"], -int(r["lượt tìm kiếm/tháng"])))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "mảng",
        "tên dự án",
        "domain dự án",
        "lượt tìm kiếm/tháng",
        "chi phí đầu trang (USD)",
        "chi phí thấp nhất (USD)",
        "cạnh tranh",
    ]
    with args.output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nTổng: {len(rows)}/{total_projects} dự án có số liệu -> {args.output}")
    if missing:
        print(f"Không có số liệu ({len(missing)}): {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
