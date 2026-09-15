"""Quét xu hướng sản phẩm vật lý theo từng quốc gia.

Cùng bộ seed hàng vật lý được chạy lại trên từng thị trường, mỗi thị trường dùng
ngôn ngữ bản địa, để thấy nước nào đang tìm gì và giá thầu ở đó rẻ tới đâu.

Tiêu chí giữ lại (theo yêu cầu ngày 2026-08-13):
    - avg_monthly_searches >= 1000
    - high_top_page_bid < 5.0 USD   (chi phí đầu trang thấp)

Cách dùng (từ thư mục server/):
    .venv\\Scripts\\python.exe scripts\\physical_country_trends.py
    .venv\\Scripts\\python.exe scripts\\physical_country_trends.py --countries VN ID TH
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))
SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from affiliate_keyword_scan import load_refresh_token, pick_customer_id  # noqa: E402
from app.shared.services.google_ads import get_keyword_ideas  # noqa: E402

import time  # noqa: E402

REPO_ROOT = SERVER_ROOT.parent
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "research" / "physical-country-trends.csv"

MIN_SEARCHES = 1_000
MAX_TOP_BID = 5.0
RETRY_DELAYS = (5, 15, 40)

# (tên, geo target ID, danh sách language ID)
# Thị trường không nói tiếng Anh quét cả ngôn ngữ bản địa lẫn tiếng Anh, vì phần lớn
# tên sản phẩm vẫn được gõ bằng tiếng Anh ở những nước này.
COUNTRIES: dict[str, tuple[str, int, list[int]]] = {
    "US": ("Hoa Kỳ", 2840, [1000]),
    "UK": ("Anh", 2826, [1000]),
    "CA": ("Canada", 2124, [1000]),
    "AU": ("Úc", 2036, [1000]),
    "DE": ("Đức", 2276, [1001, 1000]),
    "JP": ("Nhật Bản", 2392, [1005, 1000]),
    "BR": ("Brazil", 2076, [1014, 1000]),
    "IN": ("Ấn Độ", 2356, [1000]),
    "ID": ("Indonesia", 2360, [1025, 1000]),
    "PH": ("Philippines", 2608, [1042, 1000]),
    "TH": ("Thái Lan", 2764, [1044, 1000]),
    "VN": ("Việt Nam", 2704, [1040, 1000]),
}

# Seed hàng vật lý, mỗi nhóm hẹp để Google không timeout.
SEED_GROUPS: dict[str, list[str]] = {
    "điện tử": ["wireless earbuds", "smart watch"],
    "gia dụng": ["air fryer", "robot vacuum"],
    "làm đẹp": ["skin care products", "hair dryer"],
    "thể thao": ["running shoes", "yoga mat"],
    "thời trang": ["sneakers", "backpack"],
    "mẹ và bé": ["baby stroller", "baby monitor"],
    "thú cưng": ["dog food", "pet camera"],
    "nhà cửa": ["office chair", "coffee machine"],
}


def fetch_with_retry(seeds: list[str], refresh_token: str, customer_id: str,
                     language_id: int, geo_id: int) -> list[dict]:
    last_error: Exception | None = None
    for attempt, delay in enumerate((0, *RETRY_DELAYS)):
        if delay:
            print(f"        retry sau {delay}s (lần {attempt}/{len(RETRY_DELAYS)})...")
            time.sleep(delay)
        try:
            return get_keyword_ideas(
                keywords=seeds,
                refresh_token=refresh_token,
                customer_id=customer_id,
                language_id=language_id,
                location_ids=[geo_id],
                limit=200,
            )
        except Exception as exc:  # noqa: BLE001 - google-ads trả lỗi dạng chuỗi
            message = str(exc)
            if "DEADLINE_EXCEEDED" not in message and "UNAVAILABLE" not in message:
                raise
            last_error = exc
    raise RuntimeError(f"Hết lượt retry: {last_error}")


def keeps(idea: dict) -> bool:
    high = idea.get("high_top_page_bid")
    if high is None:
        return False
    return int(idea.get("avg_monthly_searches") or 0) >= MIN_SEARCHES and float(high) < MAX_TOP_BID


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--countries", nargs="*", help="Mã quốc gia cần quét (mặc định: tất cả).")
    parser.add_argument("--groups", nargs="*", help="Chỉ quét các nhóm sản phẩm chỉ định.")
    parser.add_argument("--mail", help="Email đã ủy quyền.")
    parser.add_argument("--ads-id", help="Customer ID Google Ads.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    codes = [c.upper() for c in (args.countries or COUNTRIES)]
    unknown = [c for c in codes if c not in COUNTRIES]
    if unknown:
        raise SystemExit(f"Chưa khai báo quốc gia: {', '.join(unknown)}")

    groups = args.groups or list(SEED_GROUPS)
    unknown_groups = [g for g in groups if g not in SEED_GROUPS]
    if unknown_groups:
        raise SystemExit(f"Nhóm không tồn tại: {', '.join(unknown_groups)}")

    refresh_token, mail_email = load_refresh_token(args.mail)
    customer_id, account_label = pick_customer_id(args.ads_id)
    print(f"Mail   : {mail_email}")
    print(f"Account: {account_label} ({customer_id})")
    print(f"Bộ lọc : searches >= {MIN_SEARCHES}, chi phí đầu trang < ${MAX_TOP_BID}")
    print(f"Quét   : {len(codes)} quốc gia x {len(groups)} nhóm\n")

    rows: list[dict] = []
    failed: list[str] = []

    for code in codes:
        label, geo_id, language_ids = COUNTRIES[code]
        print(f"[{code}] {label}")
        seen: set[str] = set()

        for group in groups:
            ideas: list[dict] = []
            for language_id in language_ids:
                try:
                    ideas.extend(
                        fetch_with_retry(SEED_GROUPS[group], refresh_token, customer_id, language_id, geo_id)
                    )
                except Exception as exc:  # noqa: BLE001
                    print(f"   x {group} (lang {language_id}): {type(exc).__name__} — bỏ qua")
                    failed.append(f"{code}:{group}:{language_id}")

            kept = 0
            for idea in ideas:
                if not keeps(idea) or idea["keyword"] in seen:
                    continue
                seen.add(idea["keyword"])
                kept += 1
                rows.append(
                    {
                        "quốc gia": label,
                        "mã": code,
                        "nhóm sản phẩm": group,
                        "từ khóa": idea["keyword"],
                        "lượt tìm kiếm/tháng": idea["avg_monthly_searches"],
                        "chi phí đầu trang (USD)": f"{float(idea['high_top_page_bid']):.2f}",
                        "chi phí thấp nhất (USD)": (
                            f"{float(idea['low_top_page_bid']):.2f}"
                            if idea.get("low_top_page_bid") is not None else ""
                        ),
                        "cạnh tranh": idea["competition"],
                    }
                )
            print(f"   - {group}: {len(ideas)} ý tưởng -> {kept} giữ lại")

    rows.sort(key=lambda r: (r["mã"], r["nhóm sản phẩm"], -int(r["lượt tìm kiếm/tháng"])))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "quốc gia", "mã", "nhóm sản phẩm", "từ khóa", "lượt tìm kiếm/tháng",
        "chi phí đầu trang (USD)", "chi phí thấp nhất (USD)", "cạnh tranh",
    ]
    with args.output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nTổng: {len(rows)} từ khóa -> {args.output}")
    if failed:
        print(f"Nhóm lỗi ({len(failed)}): {', '.join(failed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
