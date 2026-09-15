"""
Test runner for search_ads agent.

Cài deps trước (chỉ lần đầu):
    cd server
    pip install langgraph playwright
    playwright install chromium

Chạy từ project root (affiliate-project/):
    python -m server.app.shared.agents.search_ads.main --keyword "mua giày nike" --no-proxy

Hoặc chạy từ thư mục server/:
    python -m app.shared.agents.search_ads.main --keyword "mua giày nike" --no-proxy

Options:
    --keyword   : từ khóa cần tìm quảng cáo   (default: "mua giày nike")
    --location  : Vietnam | US | ...            (default: Vietnam)
    --language  : vi | en | ...                 (default: vi)
    --device    : desktop | mobile              (default: desktop)
    --no-proxy  : tắt proxy (dùng khi test local, không có proxy thật)
    --headful   : mở browser có giao diện (dễ debug)
    --slow-mo-ms: làm chậm thao tác browser khi debug headful
    --record-video-dir: thư mục lưu video browser context khi debug
    --output    : file JSON để lưu kết quả
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

# Fix UnicodeEncodeError khi in tiếng Việt ra Windows console (cp1252)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Đảm bảo server dir trong sys.path khi chạy trực tiếp
SERVER_ROOT = Path(__file__).resolve().parents[4]
PROJECT_ROOT = SERVER_ROOT.parent
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from app.shared.agents.search_ads.graph import build_ads_search_graph  # noqa: E402


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _build_initial_state(keyword: str, location: str, language: str, device: str) -> dict:
    return {
        "keyword": keyword,
        "location": location,
        "language": language,
        "device": device,
        "proxy": {},
        "record_video_dir": None,
        "search_url": None,
        "serp_html": None,
        "serp_screenshot_path": None,
        "organic_links": [],
        "ad_candidates": [],
        "confirmed_ads": [],
        "current_ad_index": 0,
        "final_results": [],
        "final_summary": "",
        "errors": [],
        "status": "init",
    }


def _print_result(result: dict, output_path: Path) -> None:
    sep = "=" * 64
    print(f"\n{sep}")
    print(f"  STATUS  : {result.get('status')}")
    print(f"  SUMMARY : {result.get('final_summary')}")

    if result.get("errors"):
        print(f"\n  ERRORS:")
        for e in result["errors"]:
            print(f"    · {e}")

    ads = result.get("final_results", [])
    print(f"\n  ADS FOUND: {len(ads)}")

    for i, ad in enumerate(ads, 1):
        print(f"\n  [{i}] {ad.get('title', '(no title)')}")
        print(f"       Display URL : {ad.get('display_url')}")
        print(f"       Target URL  : {ad.get('target_url')}")
        snippet = (ad.get("snippet") or "")[:100]
        if snippet:
            print(f"       Snippet     : {snippet}")
        if ad.get("advertiser_name"):
            print(
                f"       Advertiser  : {ad['advertiser_name']}"
                f" | {ad.get('advertiser_domain')}"
                f" | {ad.get('advertiser_location')}"
            )
        print(f"       Confidence  : {ad.get('confidence', 0):.0%}")

    print(f"\n{sep}\n")

    out_path = output_path.expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Full JSON saved → {out_path}")


# ─── Run ─────────────────────────────────────────────────────────────────────

async def run(
    keyword: str,
    location: str,
    language: str,
    device: str,
    no_proxy: bool,
    headful: bool,
    slow_mo_ms: int,
    record_video_dir: str | None,
) -> dict:
    state = _build_initial_state(keyword, location, language, device)
    graph = build_ads_search_graph()

    # Patch list — applied when needed
    patches = []

    if no_proxy:
        # ProxyService trả enabled=False → BrowserService bỏ qua proxy
        patches.append(
            patch(
                "app.shared.agents.search_ads.services.proxy.ProxyService.get_proxy_for_location",
                new=AsyncMock(return_value={"enabled": False}),
            )
        )

    if headful:
        # BrowserService launch headless=True → override headless=False để xem browser
        try:
            from app.shared.agents.search_ads.services.browser import BrowserService

            async def _headful_create(self, proxy=None, device="desktop", locale="vi-VN"):
                from patchright.async_api import async_playwright
                playwright = await async_playwright().start()
                browser = await playwright.chromium.launch(
                    headless=False,
                    slow_mo=slow_mo_ms,
                    args=[
                        "--disable-dev-shm-usage",
                        "--no-sandbox",
                        "--window-size=1366,768",
                    ],
                )
                context_opts = {
                    "locale": locale,
                    "viewport": {"width": 1366, "height": 768},
                    "user_agent": self.get_user_agent(device),
                    "extra_http_headers": {
                        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
                    },
                }
                if record_video_dir:
                    video_dir = Path(record_video_dir).expanduser().resolve()
                    video_dir.mkdir(parents=True, exist_ok=True)
                    context_opts["record_video_dir"] = str(video_dir)
                    context_opts["record_video_size"] = {"width": 1366, "height": 768}
                if proxy and proxy.get("enabled") and proxy.get("server"):
                    context_opts["proxy"] = {
                        "server": proxy["server"],
                        "username": proxy.get("username"),
                        "password": proxy.get("password"),
                    }
                context = await browser.new_context(**context_opts)
                return playwright, browser, context

            patches.append(
                patch(
                    "app.shared.agents.search_ads.services.browser.BrowserService.create_context",
                    new=_headful_create,
                )
            )
        except ImportError:
            print("[warn] Could not patch headful mode")

    # Apply all patches and run graph
    for p in patches:
        p.__enter__()
    try:
        result = await graph.ainvoke(state)
    finally:
        for p in reversed(patches):
            p.__exit__(None, None, None)

    return result


# ─── Entry point ─────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Test runner cho search_ads LangGraph agent"
    )
    parser.add_argument(
        "--keyword", default="mua giày nike", help="Từ khóa cần tìm quảng cáo"
    )
    parser.add_argument(
        "--location", default="Vietnam", help="Vị trí (Vietnam, US, ...)"
    )
    parser.add_argument("--language", default="vi", help="Ngôn ngữ (vi, en, ...)")
    parser.add_argument(
        "--device", default="desktop", choices=["desktop", "mobile"],
        help="Thiết bị giả lập"
    )
    parser.add_argument(
        "--no-proxy", action="store_true",
        help="Tắt proxy (bắt buộc khi test local nếu chưa có proxy thật)"
    )
    parser.add_argument(
        "--headful", action="store_true",
        help="Mở browser có giao diện để debug"
    )
    parser.add_argument(
        "--slow-mo-ms", type=int, default=0,
        help="Làm chậm thao tác browser theo mili-giây khi dùng --headful"
    )
    parser.add_argument(
        "--record-video-dir",
        default=None,
        help="Thư mục lưu video browser context khi debug"
    )
    parser.add_argument(
        "--output",
        default=str(PROJECT_ROOT / "search_ads_result.json"),
        help="File JSON để lưu kết quả sau khi chạy"
    )
    args = parser.parse_args()

    print("\n" + "=" * 64)
    print("  search_ads agent — test run")
    print(f"  Keyword  : {args.keyword}")
    print(f"  Location : {args.location}  |  Language: {args.language}  |  Device: {args.device}")
    print(f"  Proxy    : {'disabled' if args.no_proxy else 'enabled (ProxyService)'}")
    print(f"  Browser  : {'headful' if args.headful else 'headless'}")
    print("=" * 64)

    result = asyncio.run(
        run(
            keyword=args.keyword,
            location=args.location,
            language=args.language,
            device=args.device,
            no_proxy=args.no_proxy,
            headful=args.headful,
            slow_mo_ms=args.slow_mo_ms,
            record_video_dir=args.record_video_dir,
        )
    )

    _print_result(result, Path(args.output))


if __name__ == "__main__":
    main()
