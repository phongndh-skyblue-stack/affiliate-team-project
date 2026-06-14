# app/shared/services/google_search_service.py

import re
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlparse

from bs4 import BeautifulSoup

from app.shared.agents.search_ads.services.browser import BrowserService

# Nhãn section / UI labels mà Google chèn vào — KHÔNG phải ad title
_AD_LABEL_PATTERN = re.compile(
    r"^(Sponsored|Quảng cáo|Được tài trợ|Kết quả được tài trợ|"
    r"Trung tâm quảng cáo của tôi|About this ad|Ad center|"
    r"Giới thiệu về quảng cáo này|Thông tin về quảng cáo này|"
    r"Anzeige|Annonce|広告|광고)$",
    re.IGNORECASE,
)

# Selector cho nút "About this ad" / "Tại sao lại là quảng cáo này?"
# Google dùng DIV (không phải BUTTON) với aria-label hoặc jsname
_ABOUT_AD_SELECTORS = [
    "div[jsname='qRxief']",
    "div[aria-label*='T\u1ea1i sao l\u1ea1i l\u00e0 qu\u1ea3ng c\u00e1o']",
    "div[aria-label*='qu\u1ea3ng c\u00e1o n\u00e0y']",
    "div[aria-label*='About this ad']",
    "div[aria-label*='this ad']",
    "button[jsname='R5mgy']",
    "button[aria-label*='About this ad']",
    "button[aria-label*='qu\u1ea3ng c\u00e1o']",
]

_GOOGLE_CLICK_HOSTS = {"www.google.com", "google.com", "www.googleadservices.com", "googleadservices.com"}


class GoogleSearchService:
    def __init__(self):
        self.browser_service = BrowserService()

    async def search_first_page(
        self,
        keyword: str,
        location: str,
        language: str,
        device: str,
        proxy: dict,
        record_video_dir: str | None = None,
    ):
        playwright = browser = context = None

        try:
            playwright, browser, context = await self.browser_service.create_context(
                proxy=proxy,
                device=device,
                locale=self.resolve_locale(language, location),
                record_video_dir=record_video_dir,
            )

            page = await context.new_page()

            search_url = self.build_google_search_url(
                keyword=keyword,
                language=language,
                location=location,
            )

            await page.goto(search_url, wait_until="domcontentloaded", timeout=45000)
            # Đợi JS render xong (ads thường inject sau domcontentloaded)
            await page.wait_for_timeout(4000)

            html = await page.content()

            # Phát hiện CAPTCHA sớm để edge routing xử lý
            if "g-recaptcha" in html or "captcha-form" in html:
                raise Exception("captcha_detected: Google yêu cầu xác minh. Dùng proxy thật hoặc chờ trước khi thử lại.")

            import tempfile, os
            tmp_dir = tempfile.gettempdir()
            safe_kw = "".join(c if c.isalnum() else "_" for c in keyword)[:40]
            screenshot_path = os.path.join(tmp_dir, f"google_serp_{safe_kw}.png")
            try:
                await page.screenshot(path=screenshot_path, full_page=True)
            except Exception:
                screenshot_path = None

            return {
                "search_url": search_url,
                "html": html,
                "screenshot_path": screenshot_path,
            }

        finally:
            if context:
                await context.close()
            if browser:
                await browser.close()
            if playwright:
                await playwright.stop()

    def build_google_search_url(self, keyword: str, language: str, location: str = "Vietnam"):
        q = quote_plus(keyword)
        hl = language or "vi"
        gl = self.resolve_google_country(location, language)

        return f"https://www.google.com/search?q={q}&hl={hl}&gl={gl}"

    def resolve_locale(self, language: str, location: str):
        if language == "vi":
            return "vi-VN"

        locale_map = {
            "United States": "en-US",
            "United Kingdom": "en-GB",
            "Australia": "en-AU",
            "Canada": "en-CA",
            "Singapore": "en-SG",
            "Hong Kong": "en-HK",
            "New Zealand": "en-NZ",
            "India": "en-IN",
            "Malaysia": "en-MY",
            "Philippines": "en-PH",
            "South Africa": "en-ZA",
            "Ireland": "en-IE",
        }
        return locale_map.get(location, "en-US")

    def resolve_google_country(self, location: str, language: str):
        country_map = {
            "Vietnam": "vn",
            "United States": "us",
            "United Kingdom": "gb",
            "Australia": "au",
            "Singapore": "sg",
            "Canada": "ca",
            "Germany": "de",
            "France": "fr",
            "Italy": "it",
            "Spain": "es",
            "Netherlands": "nl",
            "Switzerland": "ch",
            "Sweden": "se",
            "Norway": "no",
            "Denmark": "dk",
            "Finland": "fi",
            "Ireland": "ie",
            "Belgium": "be",
            "Austria": "at",
            "Poland": "pl",
            "Portugal": "pt",
            "Greece": "gr",
            "Czech Republic": "cz",
            "Hungary": "hu",
            "Romania": "ro",
            "Turkey": "tr",
            "United Arab Emirates": "ae",
            "Saudi Arabia": "sa",
            "Qatar": "qa",
            "Kuwait": "kw",
            "India": "in",
            "Thailand": "th",
            "Indonesia": "id",
            "Malaysia": "my",
            "Philippines": "ph",
            "Japan": "jp",
            "South Korea": "kr",
            "Taiwan": "tw",
            "Hong Kong": "hk",
            "China": "cn",
            "New Zealand": "nz",
            "Brazil": "br",
            "Mexico": "mx",
            "Argentina": "ar",
            "Chile": "cl",
            "Colombia": "co",
            "Peru": "pe",
            "South Africa": "za",
            "Nigeria": "ng",
            "Kenya": "ke",
            "Egypt": "eg",
            "Israel": "il",
        }
        if location in country_map:
            return country_map[location]
        return "vn" if language == "vi" else "us"

    @staticmethod
    def _extract_ad_click_url(a_tag, fallback_href: str) -> str:
        for attr in ("data-rw", "data-ohref"):
            value = (a_tag.get(attr) or "").strip()
            if value:
                return urljoin("https://www.google.com", value)
        return fallback_href

    @staticmethod
    def _dedupe_url(url: str) -> str:
        parsed = urlparse(url)
        if parsed.netloc.lower() in _GOOGLE_CLICK_HOSTS:
            adurl = parse_qs(parsed.query).get("adurl", [None])[0]
            return unquote(adurl) if adurl else url
        return url.split("?sa=X", 1)[0]

    async def parse_serp_html(self, html: str):
        soup = BeautifulSoup(html, "lxml")
        ad_candidates: list[dict] = []
        organic_links: list[dict] = []

        # External link pattern: https:// but NOT google.com
        _ext_href = re.compile(r"^https://(?!(?:www\.)?google\.com)")

        # ── 1. Strategy A: #tads / #bottomads — dùng external link làm anchor ──
        # Google hiện dùng https:// trực tiếp thay vì /aclk redirect.
        # Mỗi <a href="https://..."> (non-Google) trong container = 1 quảng cáo.
        seen_hrefs: set[str] = set()
        position = 0

        for container_id in ("tads", "bottomads"):
            container = soup.find("div", id=container_id)
            if not container:
                continue

            ad_blocks = container.find_all("div", attrs={"data-text-ad": True})
            if not ad_blocks:
                ad_blocks = container.find_all(class_=["uEierd", "Krnil"])

            for ad_block in ad_blocks:
                link_candidates = [
                    a_tag for a_tag in ad_block.find_all("a", href=True)
                    if _ext_href.match(a_tag["href"])
                ]
                if not link_candidates:
                    continue

                a_tag = next(
                    (
                        item for item in link_candidates
                        if item.find(attrs={"role": "heading"}) or item.find("span")
                    ),
                    link_candidates[0],
                )
                href = a_tag["href"]
                click_url = self._extract_ad_click_url(a_tag, href)

                dedupe_key = self._dedupe_url(click_url)
                if dedupe_key in seen_hrefs:
                    continue
                seen_hrefs.add(dedupe_key)
                position += 1

                # Title: heading INSIDE the link (Google wraps heading inside <a>)
                title = None
                h_in = a_tag.find(attrs={"role": "heading"})
                if h_in:
                    candidate = h_in.get_text(strip=True)
                    if candidate and not _AD_LABEL_PATTERN.match(candidate):
                        title = candidate
                # Fallback: heading before this link
                if not title:
                    h_el = a_tag.find_previous(attrs={"role": "heading"})
                    while h_el:
                        if container not in h_el.parents:
                            break
                        candidate = h_el.get_text(strip=True)
                        if candidate and not _AD_LABEL_PATTERN.match(candidate):
                            title = candidate
                            break
                        h_el = h_el.find_previous(attrs={"role": "heading"})

                # Display URL: <cite> inside block (walk up)
                cite_el = None
                block = a_tag.parent
                for _ in range(8):
                    if block is None or block == container:
                        break
                    cite_el = block.find("cite")
                    if cite_el:
                        break
                    block = block.parent
                # Fallback: extract domain from href
                display_url = cite_el.get_text(strip=True) if cite_el else ""
                if not display_url:
                    display_url = urlparse(href).netloc

                # Snippet: text dài trong parent block
                block = a_tag.parent
                for _ in range(6):
                    if block is None or block == container:
                        break
                    texts = [
                        t.strip() for t in block.stripped_strings
                        if len(t.strip()) > 40
                        and t.strip() not in (title or "", display_url or "")
                        and not _AD_LABEL_PATTERN.match(t.strip())
                    ]
                    if texts:
                        break
                    block = block.parent
                snippet = texts[0] if texts else None

                ad_candidates.append({
                    "position": position,
                    "title": title,
                    "snippet": snippet,
                    "display_url": display_url,
                    "target_url": click_url,
                    "display_target_url": href,
                    "is_ad": True,
                    "confidence": 0.85,
                    "source": "serp_html_parse",
                })

        # ── 2. Strategy B: data-text-ad attribute (fallback) ─────────────────
        if not ad_candidates:
            for block in soup.find_all("div", attrs={"data-text-ad": True}):
                for a_tag in block.find_all("a", href=True):
                    href = a_tag["href"]
                    click_url = self._extract_ad_click_url(a_tag, href)
                    if not _ext_href.match(href):
                        continue

                    dedupe_key = self._dedupe_url(click_url)
                    if dedupe_key in seen_hrefs:
                        continue
                    seen_hrefs.add(dedupe_key)
                    position += 1

                    title = None
                    for h in block.find_all(attrs={"role": "heading"}):
                        candidate = h.get_text(strip=True)
                        if candidate and not _AD_LABEL_PATTERN.match(candidate):
                            title = candidate
                            break

                    cite_el = block.find("cite")
                    display_url = cite_el.get_text(strip=True) if cite_el else ""
                    if not display_url:
                        display_url = urlparse(href).netloc

                    ad_candidates.append({
                        "position": position,
                        "title": title,
                        "snippet": None,
                        "display_url": display_url,
                        "target_url": click_url,
                        "display_target_url": href,
                        "is_ad": True,
                        "confidence": 0.80,
                        "source": "serp_html_parse_data_text_ad",
                    })
                    break  # 1 link per block

        # ── 3. Organic links ──────────────────────────────────────────────────
        search_div = soup.find("div", id="search") or soup.find("div", id="rso")
        if search_div:
            for a in search_div.find_all("a", href=True):
                href_val = a["href"]
                if href_val.startswith("http") and "google.com" not in href_val:
                    h3 = a.find("h3")
                    if h3:
                        organic_links.append(
                            {"title": h3.get_text(strip=True), "url": href_val}
                        )

        return {
            "ad_candidates": ad_candidates,
            "organic_links": organic_links[:10],
        }

    async def extract_ad_info_from_candidates(
        self,
        keyword: str,
        location: str,
        language: str,
        device: str,
        proxy: dict,
        ad_candidates: list[dict],
        record_video_dir: str | None = None,
    ):
        """
        Mở lại SERP bằng Playwright, với từng ad candidate:
        1. Tìm đúng block theo title
        2. Hover để hiện nút "About this ad"
        3. Click → đọc panel → lấy advertiser name / domain / location
        Nếu không click được, fallback về domain từ display_url.
        """
        if not ad_candidates:
            return []

        playwright = browser = context = None
        confirmed_ads = list(ad_candidates)  # copy để mutate

        try:
            playwright, browser, context = await self.browser_service.create_context(
                proxy=proxy,
                device=device,
                locale=self.resolve_locale(language, location),
                record_video_dir=record_video_dir,
            )
            page = await context.new_page()

            search_url = self.build_google_search_url(
                keyword=keyword, language=language
            )
            await page.goto(search_url, wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(2000)

            for i, ad in enumerate(confirmed_ads):
                title = ad.get("title") or ""
                display_url = ad.get("display_url") or ""

                # Fallback domain từ display_url
                domain_fallback = display_url.split("/")[0].lstrip("www.") if display_url else None

                try:
                    # Tìm element chứa đúng title của ad
                    ad_el = None
                    if title:
                        ad_el = await page.query_selector(
                            f"text={title[:40]}"  # query bằng 40 ký tự đầu
                        )
                    if not ad_el and display_url:
                        ad_el = await page.query_selector(f"text={display_url[:30]}")

                    # Tìm button "About this ad" scoped vào ad block trước, fallback toàn trang
                    btn = None
                    if ad_el:
                        await ad_el.hover(timeout=3000)
                        await page.wait_for_timeout(600)
                        # Thử tìm button gần với ad element
                        ad_block = await ad_el.evaluate_handle(
                            "el => el.closest('[data-text-ad], [data-hveid], li, div.uEierd, div.commercial-unit-desktop-top') || el.parentElement?.parentElement?.parentElement"
                        )
                        if ad_block:
                            for selector in _ABOUT_AD_SELECTORS:
                                try:
                                    btn = await ad_block.query_selector(selector)
                                    if btn:
                                        break
                                except Exception:
                                    pass

                    # Fallback: tìm toàn trang nếu không scope được
                    if not btn:
                        for selector in _ABOUT_AD_SELECTORS:
                            btn = await page.query_selector(selector)
                            if btn:
                                break

                    if btn:
                        await btn.click(timeout=3000)
                        await page.wait_for_timeout(1500)

                        # Đọc nội dung panel / dialog
                        panel = await page.query_selector(
                            "div[role='dialog'], div[jsname='BVmXmd'], div.UGa6Jb"
                        )
                        if panel:
                            await self._expand_advertiser_section(panel)
                            panel_text = await panel.inner_text()
                            import sys as _sys
                            print(f"\n[DEBUG panel ad#{i}]\n{panel_text}\n[/DEBUG]", file=_sys.stderr)
                            info = self._parse_advertiser_panel(panel_text, domain_fallback)
                            confirmed_ads[i] = {
                                **ad,
                                "is_ad": True,
                                "advertiser_name": info["advertiser_name"],
                                "advertiser_domain": info["advertiser_domain"],
                                "advertiser_location": info["advertiser_location"],
                                "confidence": 0.95,
                                "source": "google_serp_about_ad",
                            }

                            # Đóng panel
                            close_btn = await page.query_selector(
                                "button[aria-label*='Close'], button[aria-label*='Đóng'], "
                                "button[aria-label*='Done'], button[aria-label*='Xong']"
                            )
                            if close_btn:
                                await close_btn.click(timeout=2000)
                                await page.wait_for_timeout(500)
                            continue

                except Exception as _ex:
                    import sys as _sys
                    print(f"[DEBUG extract ad#{i} error] {type(_ex).__name__}: {_ex}", file=_sys.stderr)

                # Fallback: chỉ điền domain từ display_url
                confirmed_ads[i] = {
                    **ad,
                    "is_ad": True,
                    "advertiser_name": None,
                    "advertiser_domain": domain_fallback,
                    "advertiser_location": None,
                    "confidence": 0.80,
                    "source": "google_serp_html_fallback",
                }

        except Exception:
            pass  # Trả về những gì đã enrich được

        finally:
            if context:
                await context.close()
            if browser:
                await browser.close()
            if playwright:
                await playwright.stop()

        return confirmed_ads

    # ── Combined: search + parse SERP + extract ad info in ONE browser session ──

    async def search_and_extract_ads(
        self,
        keyword: str,
        location: str,
        language: str,
        device: str,
        proxy: dict,
        record_video_dir: str | None = None,
    ) -> dict:
        """
        Mở browser MỘT LẦN DUY NHẤT:
        1. Navigate to Google SERP
        2. Lấy HTML + screenshot
        3. Parse HTML để tìm ad candidates
        4. Click nút 3 chấm của từng ad để lấy advertiser info
        Trả về: {search_url, html, screenshot_path, confirmed_ads, organic_links}
        """
        playwright = browser = context = None

        try:
            playwright, browser, context = await self.browser_service.create_context(
                proxy=proxy,
                device=device,
                locale=self.resolve_locale(language, location),
                record_video_dir=record_video_dir,
            )
            page = await context.new_page()

            search_url = self.build_google_search_url(
                keyword=keyword,
                language=language,
                location=location,
            )

            await page.goto(search_url, wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(4000)

            html = await page.content()

            if "g-recaptcha" in html or "captcha-form" in html:
                raise Exception("captcha_detected: Google yêu cầu xác minh. Dùng proxy thật hoặc chờ trước khi thử lại.")

            import tempfile, os
            tmp_dir = tempfile.gettempdir()
            safe_kw = "".join(c if c.isalnum() else "_" for c in keyword)[:40]
            screenshot_path = os.path.join(tmp_dir, f"google_serp_{safe_kw}.png")
            try:
                await page.screenshot(path=screenshot_path, full_page=True)
            except Exception:
                screenshot_path = None

            # Parse SERP HTML
            parsed = await self.parse_serp_html(html)
            ad_candidates: list[dict] = parsed["ad_candidates"]
            organic_links: list[dict] = parsed["organic_links"]

            if not ad_candidates:
                return {
                    "search_url": search_url,
                    "html": html,
                    "screenshot_path": screenshot_path,
                    "confirmed_ads": [],
                    "organic_links": organic_links,
                }

            # Extract advertiser info trong cùng browser session
            confirmed_ads = list(ad_candidates)

            # Dump HTML của #tads để debug selector một lần
            import sys as _sys, os as _os, tempfile as _tf
            try:
                tads_html = await page.evaluate("""() => {
                    const el = document.querySelector('#tads') || document.querySelector('[data-text-ad]');
                    return el ? el.innerHTML.substring(0, 8000) : 'NOT_FOUND';
                }""")
                _debug_path = _os.path.join(_tf.gettempdir(), "tads_debug.html")
                with open(_debug_path, "w", encoding="utf-8") as _f:
                    _f.write(tads_html)
                print(f"[DEBUG] #tads HTML dumped to: {_debug_path}", file=_sys.stderr)

                # In toàn bộ aria-label của các button trong tads
                btns_info = await page.evaluate("""() => {
                    const result = [];
                    document.querySelectorAll('button, [role=button]').forEach(el => {
                        const lbl = el.getAttribute('aria-label') || '';
                        const jn  = el.getAttribute('jsname') || '';
                        if (lbl || jn) result.push({tag: el.tagName, label: lbl, jsname: jn});
                    });
                    return result;
                }""")
                print(f"[DEBUG] buttons on page: {btns_info[:30]}", file=_sys.stderr)
            except Exception as _de:
                print(f"[DEBUG dump error] {_de}", file=_sys.stderr)

            # JS để lấy tất cả các nút "3 chấm" (about this ad) có trên trang
            for i, ad in enumerate(confirmed_ads):
                display_url = ad.get("display_url") or ""
                domain_fallback = display_url.split("/")[0].lstrip("www.") if display_url else None

                try:
                    # Scroll đến vị trí khoảng ad này (tránh scroll quá xa)
                    await page.evaluate(f"window.scrollTo(0, {i * 200})")
                    await page.wait_for_timeout(300)

                    # Tìm nút "3 chấm" (Why this ad / Tại sao là quảng cáo)
                    # Ưu tiên tìm trong container của ad cụ thể, fallback tìm toàn trang
                    btn = await page.evaluate_handle("""(idx) => {
                        const BTN_SELS = [
                            '[aria-label*="Why this ad"]',
                            '[title*="Why this ad"]',
                            '[aria-label*="T\\u1ea1i sao l\\u1ea1i l\\u00e0 qu\\u1ea3ng c\\u00e1o"]',
                            '[title*="T\\u1ea1i sao"]',
                            '[aria-label*="qu\\u1ea3ng c\\u00e1o n\\u00e0y"]',
                            '[aria-label*="About this ad"]',
                            '[title*="About this ad"]',
                            'div[jsname="qRxief"]',
                            'button[jsname="R5mgy"]',
                        ];
                        // Thử tìm trong container ad cụ thể trước
                        const adContainers = document.querySelectorAll(
                            '#tads .uEierd, #tads .Krnil, #tads [data-hveid], #tads > div > div'
                        );
                        if (adContainers.length > idx) {
                            const container = adContainers[idx];
                            for (const sel of BTN_SELS) {
                                const el = container.querySelector(sel);
                                if (el) return el;
                            }
                        }
                        // Fallback: toàn trang theo index
                        for (const sel of BTN_SELS) {
                            const all = document.querySelectorAll(sel);
                            if (all.length > idx) return all[idx];
                            if (all.length > 0) return all[0];
                        }
                        return null;
                    }""", i)

                    is_element = await page.evaluate(
                        "el => el !== null && el !== undefined && typeof el.tagName === 'string'", btn
                    )

                    if not is_element:
                        # Hover để trigger nút xuất hiện rồi thử lại
                        title = ad.get("title") or ""
                        ad_el = None
                        if title:
                            ad_el = await page.query_selector(f"text={title[:35]}")
                        if not ad_el and display_url:
                            ad_el = await page.query_selector(f"text={display_url[:25]}")
                        if ad_el:
                            await ad_el.hover(timeout=3000)
                            await page.wait_for_timeout(800)
                            btn = await page.evaluate_handle("""(idx) => {
                                const BTN_SELS = [
                                    '[aria-label*="Why this ad"]',
                                    '[title*="Why this ad"]',
                                    '[aria-label*="T\\u1ea1i sao l\\u1ea1i l\\u00e0 qu\\u1ea3ng c\\u00e1o"]',
                                    '[title*="T\\u1ea1i sao"]',
                                    '[aria-label*="About this ad"]',
                                    'div[jsname="qRxief"]',
                                    'button[jsname="R5mgy"]',
                                ];
                                for (const sel of BTN_SELS) {
                                    const all = document.querySelectorAll(sel);
                                    if (all.length > idx) return all[idx];
                                    if (all.length > 0) return all[0];
                                }
                                return null;
                            }""", i)
                            is_element = await page.evaluate(
                                "el => el !== null && el !== undefined && typeof el.tagName === 'string'", btn
                            )

                    if not is_element:
                        import sys as _sys
                        print(f"[DEBUG ad#{i}] no button found", file=_sys.stderr)
                        raise Exception("no_button")

                    # Log button được click
                    import sys as _sys
                    btn_info = await page.evaluate(
                        "el => ({tag: el.tagName, label: el.getAttribute('aria-label'), jsname: el.getAttribute('jsname'), title: el.getAttribute('title')})",
                        btn
                    )
                    print(f"[DEBUG ad#{i}] clicking: {btn_info}", file=_sys.stderr)

                    # Scroll vào viewport và JS click
                    await page.evaluate("el => el.scrollIntoView({block:'center'})", btn)
                    await page.wait_for_timeout(400)
                    await page.evaluate("el => el.click()", btn)

                    # Chờ rồi tìm dialog visible có nội dung thật
                    # Dùng query_selector_all để lấy ElementHandle thật (có .inner_text())
                    await page.wait_for_timeout(600)
                    panel = None
                    for _attempt in range(8):  # poll tối đa 4 giây
                        all_dialogs = await page.query_selector_all('[role="dialog"]')
                        for d in all_dialogs:
                            try:
                                visible = await d.is_visible()
                                if not visible:
                                    continue
                                txt = await d.inner_text()
                                if len(txt.strip()) > 20:
                                    panel = d
                                    break
                            except Exception:
                                continue
                        if panel:
                            break
                        await page.wait_for_timeout(500)

                    import sys as _sys
                    print(f"[DEBUG ad#{i}] panel found: {panel is not None}", file=_sys.stderr)

                    if panel:
                        panel_text = await panel.inner_text()
                        print(f"\n[DEBUG panel ad#{i}]\n{repr(panel_text[:400])}\n[/DEBUG]", file=_sys.stderr)
                        await self._expand_advertiser_section(panel)
                        panel_text = await panel.inner_text()
                        print(f"\n[DEBUG panel_after_expand ad#{i}]\n{repr(panel_text[:400])}\n[/DEBUG]", file=_sys.stderr)
                        info = self._parse_advertiser_panel(panel_text, domain_fallback)
                        confirmed_ads[i] = {
                            **ad,
                            "is_ad": True,
                            **info,
                            "confidence": 0.95,
                            "source": "google_serp_about_ad",
                        }
                    else:
                        print(f"[DEBUG ad#{i}] panel not found after click", file=_sys.stderr)
                        raise Exception("no_panel")

                    # Đóng panel: Back về main menu trước, rồi mới close
                    # (Tránh panel giữ state sub-page khi mở ad tiếp theo)
                    try:
                        back_btn = await page.query_selector(
                            "[jsname='LBJcic'][role='button'], "
                            "[aria-label='Back'][role='button'], "
                            "span[jsname='LBJcic']"
                        )
                        if back_btn:
                            visible = await back_btn.is_visible()
                            if visible:
                                await page.evaluate("el => el.click()", back_btn)
                                await page.wait_for_timeout(400)
                    except Exception:
                        pass

                    try:
                        # Ưu tiên click X button, fallback Escape
                        close_btn = await page.query_selector(
                            "[jsname='vDg59d'][role='button'], "
                            "[aria-label='Close'][role='button']"
                        )
                        if close_btn:
                            await page.evaluate("el => el.click()", close_btn)
                        else:
                            await page.keyboard.press("Escape")
                        # Chờ TẤT CẢ dialogs biến mất hoàn toàn trước khi xử lý ad tiếp
                        for _ in range(10):
                            await page.wait_for_timeout(300)
                            dialogs = await page.query_selector_all('[role="dialog"]')
                            any_visible = False
                            for d in dialogs:
                                try:
                                    if await d.is_visible():
                                        any_visible = True
                                        break
                                except Exception:
                                    pass
                            if not any_visible:
                                break
                    except Exception:
                        await page.keyboard.press("Escape")
                        await page.wait_for_timeout(600)
                    continue

                except Exception as _ex:
                    import sys as _sys
                    print(f"[DEBUG extract ad#{i} error] {type(_ex).__name__}: {_ex}", file=_sys.stderr)

                confirmed_ads[i] = {
                    **ad,
                    "is_ad": True,
                    "advertiser_name": None,
                    "advertiser_domain": domain_fallback,
                    "advertiser_location": None,
                    "confidence": 0.80,
                    "source": "google_serp_html_fallback",
                }

            return {
                "search_url": search_url,
                "html": html,
                "screenshot_path": screenshot_path,
                "confirmed_ads": confirmed_ads,
                "organic_links": organic_links,
            }

        finally:
            if context:
                await context.close()
            if browser:
                await browser.close()
            if playwright:
                await playwright.stop()

    @staticmethod
    async def _expand_advertiser_section(panel) -> None:
        """
        Click vào menu item 'About this advertiser' / 'Giới thiệu về nhà quảng cáo này'
        để mở subpage hiển thị tên và địa điểm nhà quảng cáo.
        """
        import sys as _sys
        import asyncio
        _SECTION_TEXTS = [
            "About this advertiser",
            "Giới thiệu về nhà quảng cáo này",
            "Giới thiệu về nhà quảng cáo",
            "Thông tin về nhà quảng cáo",
            "Nhà quảng cáo này",
            "Über diesen Werbetreibenden",
            "À propos de cet annonceur",
        ]
        for text in _SECTION_TEXTS:
            try:
                el = await panel.query_selector(f"text={text}")
                if el:
                    print(f"[DEBUG expand] clicking section: {repr(text)}", file=_sys.stderr)
                    await el.click(timeout=2000)
                    await asyncio.sleep(1.5)  # chờ subpage animate
                    return
            except Exception as e:
                print(f"[DEBUG expand] failed for {repr(text)}: {e}", file=_sys.stderr)
                continue

        # Fallback: aria-expanded="false"
        try:
            collapsed = await panel.query_selector("[aria-expanded='false']")
            if collapsed:
                print("[DEBUG expand] fallback aria-expanded click", file=_sys.stderr)
                await collapsed.click(timeout=2000)
                import asyncio as _asyncio
                await _asyncio.sleep(1.5)
        except Exception:
            pass

    @staticmethod
    def _parse_advertiser_panel(panel_text: str, domain_fallback: str | None) -> dict:
        """
        Parse panel 'About this advertiser' / 'My Ad Centre'.
        Cấu trúc (EN):
            Advertiser      ← label
            Paid for by XYZ ← value (advertiser_name)
            Location        ← label
            United Arab Emirates ← value (advertiser_location)
        Cấu trúc (VI):
            Nhà quảng cáo   ← label
            Thanh toán bởi XYZ ← value
            Địa điểm        ← label
            Việt Nam        ← value
        """
        lines = [l.strip() for l in panel_text.splitlines() if l.strip()]

        _ADVERTISER_LABEL = re.compile(
            r"^(advertiser|nhà quảng cáo|werbetreibender|annonceur|adverteerder|anunciante)$",
            re.IGNORECASE,
        )
        _LOCATION_LABEL = re.compile(
            r"^(location|v\u1ecb tr\u00ed|\u0111\u1ecba \u0111i\u1ec3m|standort|lieu|locatie|ubicaci[o\u00f3]n|\u4f4d\u7f6e|\uc704\uce58)$",
            re.IGNORECASE,
        )

        _PAID_FOR_PREFIX = re.compile(
            r"^(paid for by|b\u00ean tr\u1ea3 ti\u1ec1n qu\u1ea3ng c\u00e1o|bezahlt von|pay\u00e9 par|betaald door|pagado por)\s*:?\s*",
            re.IGNORECASE,
        )

        advertiser_name: str | None = None
        advertiser_location: str | None = None

        for idx, line in enumerate(lines):
            if advertiser_name is None and _ADVERTISER_LABEL.match(line):
                if idx + 1 < len(lines):
                    raw = lines[idx + 1]
                    advertiser_name = _PAID_FOR_PREFIX.sub("", raw).strip() or raw
            if advertiser_location is None and _LOCATION_LABEL.match(line):
                if idx + 1 < len(lines):
                    advertiser_location = lines[idx + 1]

        return {
            "advertiser_name": advertiser_name,
            "advertiser_domain": domain_fallback,
            "advertiser_location": advertiser_location,
        }
