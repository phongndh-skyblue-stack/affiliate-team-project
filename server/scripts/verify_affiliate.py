"""Xác minh từng dự án có chương trình affiliate hay không.

Không tin vào danh sách tổng hợp trên blog: script mở thẳng website của dự án,
đọc link trong trang chủ, rồi dò các đường dẫn affiliate thông dụng. Kết quả ghi
kèm bằng chứng là URL tìm được và mạng affiliate nhận ra trong trang.

Cách dùng (từ thư mục server/):
    .venv\Scripts\python.exe scripts\verify_affiliate.py
    .venv\Scripts\python.exe scripts\verify_affiliate.py --verticals ai_agents ai_seo
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parents[2]
TABLE = REPO_ROOT / "docs" / "research" / "affiliate-projects-table.csv"
OUTPUT = REPO_ROOT / "docs" / "research" / "affiliate-verification.csv"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}
TIMEOUT = 12

# Đường dẫn hay gặp khi trang chủ không lộ link.
COMMON_PATHS = [
    "/affiliate", "/affiliates", "/affiliate-program", "/affiliates-program",
    "/partners", "/partner", "/partner-program", "/partners/affiliate",
    "/referral", "/refer", "/pages/affiliate", "/pages/affiliates",
    "/affiliate-programme", "/creators", "/ambassador",
]

# Mạng affiliate: thấy tên này trong trang là bằng chứng mạnh.
NETWORKS = {
    "impact.com": "Impact", "impactradius": "Impact", "shareasale": "ShareASale",
    "cj.com": "CJ", "commissionjunction": "CJ", "awin.com": "Awin",
    "rakutenadvertising": "Rakuten", "linksynergy": "Rakuten",
    "partnerstack": "PartnerStack", "refersion": "Refersion",
    "tapfiliate": "Tapfiliate", "everflow": "Everflow", "firstpromoter": "FirstPromoter",
    "postaffiliatepro": "PostAffiliatePro", "goaffpro": "GoAffPro",
    "leaddyno": "LeadDyno", "affiliatly": "Affiliatly", "shopify.com/affiliate": "Shopify",
    "getrewardful": "Rewardful", "rewardful": "Rewardful", "growsurf": "GrowSurf",
    "uppromote": "UpPromote", "flexoffers": "FlexOffers", "pepperjam": "Pepperjam",
    "avantlink": "AvantLink", "shareasale.com": "ShareASale",
}

LINK_WORDS = re.compile(r"affiliate|referral program|refer a friend|ambassador|partner", re.I)

# "Partner program" của phần mềm B2B thường là đối tác tích hợp, không trả hoa hồng
# giới thiệu. Chỉ tính là affiliate khi trang nói rõ về chương trình giới thiệu.
AFFILIATE_PROOF = re.compile(
    r"affiliate program|affiliate programme|become an affiliate|join our affiliate|"
    r"join the affiliate|our affiliate program|affiliate partner",
    re.I,
)
REFERRAL_PROOF = re.compile(
    r"referral program|refer and earn|refer a friend|ambassador program|creator program",
    re.I,
)


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def find_networks(text: str) -> list[str]:
    lowered = text.lower()
    return sorted({label for token, label in NETWORKS.items() if token in lowered})


def classify_page(html: str, url: str) -> str | None:
    """Trả về 'affiliate', 'referral' hoặc None nếu trang không chứng minh được gì."""
    text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
    if AFFILIATE_PROOF.search(text):
        return "affiliate"
    # URL có chữ affiliate nhưng nội dung không nhắc tới thì không tính là bằng chứng.
    if REFERRAL_PROOF.search(text):
        return "referral"
    return None


def is_soft_404(url: str) -> bool:
    """Nhiều site đá đường dẫn không tồn tại về trang chủ, đọc nhầm thành trang affiliate."""
    return urlparse(url).path.strip("/").lower() in ("", "home", "index", "index.html")


def check_project(item: dict) -> dict:
    domain = item["domain"]
    base = f"https://{domain}"
    result = {
        "mảng": item["vertical"],
        "tên dự án": item["name"],
        "domain dự án": domain,
        "có affiliate": "không rõ",
        "trang affiliate": "",
        "mạng affiliate": "",
        "ghi chú": "",
    }

    with session() as http:
        homepage_html = ""
        try:
            response = http.get(base, timeout=TIMEOUT, allow_redirects=True)
            if response.ok:
                homepage_html = response.text
        except Exception as exc:  # noqa: BLE001 - mạng lỗi kiểu gì cũng chỉ ghi nhận
            result["ghi chú"] = f"trang chủ lỗi: {type(exc).__name__}"

        # 1. Link ngay trong trang chủ là bằng chứng đáng tin nhất.
        candidates: list[str] = []
        if homepage_html:
            networks = find_networks(homepage_html)
            if networks:
                result["mạng affiliate"] = ", ".join(networks)

            soup = BeautifulSoup(homepage_html, "html.parser")
            for anchor in soup.find_all("a", href=True):
                label = anchor.get_text(" ", strip=True)
                href = anchor["href"]
                if LINK_WORDS.search(label) or LINK_WORDS.search(href):
                    url = urljoin(base, href)
                    if urlparse(url).scheme in ("http", "https"):
                        candidates.append(url)

        seen: set[str] = set()
        unique = [u for u in candidates if not (u in seen or seen.add(u))]
        # URL có chữ affiliate đáng tin hơn link partner chung chung nên xét trước.
        unique.sort(key=lambda u: 0 if "affiliate" in u.lower() else 1)
        ordered = unique[:6] + [base + path for path in COMMON_PATHS]

        for url in ordered:
            try:
                page = http.get(url, timeout=TIMEOUT, allow_redirects=True)
            except Exception:  # noqa: BLE001
                continue
            if not page.ok or not page.text:
                continue
            if is_soft_404(page.url):
                continue
            kind = classify_page(page.text, page.url)
            if kind is None:
                continue

            result["có affiliate"] = "có" if kind == "affiliate" else "chỉ referral"
            result["trang affiliate"] = page.url
            networks = find_networks(page.text) or find_networks(page.url)
            if networks:
                result["mạng affiliate"] = ", ".join(
                    sorted(set(networks) | set(filter(None, result["mạng affiliate"].split(", "))))
                )
            return result

        if result["mạng affiliate"]:
            result["có affiliate"] = "có thể"
            result["ghi chú"] = "thấy dấu vết mạng affiliate ở trang chủ, chưa mở được trang riêng"
        elif not homepage_html and not result["ghi chú"]:
            result["ghi chú"] = "không tải được trang chủ"
        elif homepage_html:
            result["có affiliate"] = "không thấy"

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verticals", nargs="*", help="Chỉ kiểm tra các mảng chỉ định.")
    parser.add_argument("--recheck", type=Path, help="File xác minh cũ; chỉ soát lại dòng đã đánh có/có thể.")
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()

    projects = [
        {"vertical": r["mảng"], "name": r["tên dự án"], "domain": r["domain dự án"]}
        for r in csv.DictReader(TABLE.open(encoding="utf-8-sig"))
    ]
    if args.verticals:
        wanted = set(args.verticals)
        projects = [p for p in projects if p["vertical"] in wanted]
    if args.recheck:
        prior = {
            (r["mảng"], r["tên dự án"])
            for r in csv.DictReader(args.recheck.open(encoding="utf-8-sig"))
            if r["có affiliate"] in ("có", "có thể")
        }
        projects = [p for p in projects if (p["vertical"], p["name"]) in prior]

    print(f"Kiểm tra {len(projects)} dự án với {args.workers} luồng...\n")

    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for index, result in enumerate(pool.map(check_project, projects), start=1):
            results.append(result)
            if index % 25 == 0 or index == len(projects):
                print(f"   {index}/{len(projects)}")

    results.sort(key=lambda r: (r["mảng"], r["tên dự án"]))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(results[0]))
        writer.writeheader()
        writer.writerows(results)

    tally: dict[str, int] = {}
    for r in results:
        tally[r["có affiliate"]] = tally.get(r["có affiliate"], 0) + 1
    print("\nKết quả:", ", ".join(f"{k}: {v}" for k, v in sorted(tally.items())))
    print(f"-> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
