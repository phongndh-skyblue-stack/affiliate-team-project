"""SimilarWeb Pro — cookie helper.

Quản lý session cookie cho pro.similarweb.com:
- In-memory cache (module-level) + asyncio.Lock
- refresh bằng Selenium (blocking, gọi qua asyncio.to_thread)
- build header dict cho httpx

Public async API:
    get_headers()                       → dict headers sẵn sàng dùng
    refresh_cookie(stale_cookie=None)   → str cookie mới
"""
from __future__ import annotations

import asyncio
import logging
import random
import time

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SIMILARWEB_LOGIN_URL = "https://secure.similarweb.com/account/login"
SIMILARWEB_PRO_URL = "https://pro.similarweb.com/"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
)
COOKIE_FIELDS = [
    ".SGTOKEN.SIMILARWEB.COM",
    "_sw_pin",
    "locale",
    "_dd_s",
    "_sw_pin_ps",
    "aws-waf-token",
    "RESET_PRO_CACHE",
    "sgID",
]

# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------

_cookie_cache: str | None = None
_refresh_lock = asyncio.Lock()


def get_cookie_from_cache() -> str | None:
    return _cookie_cache


def _save_cookie(cookie: str) -> None:
    global _cookie_cache
    _cookie_cache = cookie
    logger.info("[SW_UTILS] Cookie đã lưu vào in-memory cache")


def _delete_cookie() -> None:
    global _cookie_cache
    _cookie_cache = None
    logger.info("[SW_UTILS] Cookie cache đã xoá")


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------


async def refresh_cookie(stale_cookie: str | None = None) -> str:
    """Refresh cookie với asyncio.Lock để tránh nhiều coroutine chạy Selenium cùng lúc.

    Nếu lock đang bị giữ bởi coroutine khác → chờ, sau đó dùng cookie mới.
    """
    async with _refresh_lock:
        # Sau khi acquire lock — kiểm tra xem coroutine trước đã refresh chưa
        current = get_cookie_from_cache()
        if current and stale_cookie and current != stale_cookie:
            logger.info("[SW_UTILS] Cookie đã được refresh bởi coroutine khác, dùng luôn")
            return current

        _delete_cookie()
        logger.info("[SW_UTILS] Bắt đầu Selenium login để refresh cookie...")
        new_cookie = await asyncio.to_thread(refresh_cookie_blocking, False)
        _save_cookie(new_cookie)
        return new_cookie


async def get_headers() -> dict[str, str]:
    """Lấy headers sẵn sàng gửi widgetApi.

    1. Đọc cookie từ in-memory cache.
    2. Nếu cache rỗng → gọi refresh_cookie() (Selenium login).
    3. Build và trả header dict.
    """
    cookie = get_cookie_from_cache()
    if not cookie:
        logger.info("[SW_UTILS] Cache rỗng, refresh cookie qua Selenium...")
        cookie = await refresh_cookie()
    return build_headers(cookie)


def build_headers(cookie: str) -> dict[str, str]:
    """Tạo HTTP headers cho httpx request tới pro.similarweb.com."""
    return {
        "accept": "application/json",
        "accept-language": "vi,en-US;q=0.9,en;q=0.8",
        "content-type": "application/json; charset=utf-8",
        "referer": "https://pro.similarweb.com/",
        "sec-ch-ua": '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Linux"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": USER_AGENT,
        "x-requested-with": "XMLHttpRequest",
        "x-sw-page": "https://pro.similarweb.com",
        "cookie": cookie,
    }


# ---------------------------------------------------------------------------
# Selenium helpers (blocking — gọi qua asyncio.to_thread)
# ---------------------------------------------------------------------------


def _wait_for_hub(hub_url: str, timeout: int = 30) -> None:
    """Chờ Selenium Hub sẵn sàng (status ready=true)."""
    import httpx as _httpx

    deadline = time.time() + timeout
    status_url = hub_url.rstrip("/").replace("/wd/hub", "") + "/status"
    logger.info("[Hub] Kiểm tra Selenium Hub tại: %s", status_url)
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        try:
            r = _httpx.get(status_url, timeout=3, trust_env=False)
            logger.debug("[Hub] attempt=%d status_code=%d body=%s", attempt, r.status_code, r.text[:300])
            if r.status_code == 200:
                data = r.json()
                if data.get("value", {}).get("ready"):
                    logger.info("[Hub] Selenium Hub sẵn sàng sau %d lần thử", attempt)
                    return
                logger.warning("[Hub] Hub phản hồi nhưng ready=false: %s", data)
            elif r.status_code in (301, 302):
                # Cloudflare buộc HTTP→HTTPS — không follow redirect, fail fast
                location = r.headers.get("location", "")
                raise RuntimeError(
                    f"Selenium Hub tại {hub_url} bị redirect ({r.status_code}) sang {location}. "
                    "Cloudflare đang chặn HTTP. Hãy đặt SELENIUM_HUB_URL bắt đầu bằng https:// "
                    "và sửa Cloudflare SSL mode thành 'Flexible' để tránh lỗi 525."
                )
            elif r.status_code in (502, 503, 520, 521, 522, 523, 524, 525, 526):
                # Cloudflare/proxy error trước origin — raise ngay, không retry
                raise RuntimeError(
                    f"Selenium Hub tại {hub_url} trả HTTP {r.status_code} (Cloudflare error). "
                    "Hub đang down hoặc bị Cloudflare chặn. "
                    "Kiểm tra SSL/TLS config (đổi sang Flexible) hoặc dùng URL nội bộ."
                )
            else:
                logger.warning("[Hub] attempt=%d HTTP %d", attempt, r.status_code)
        except RuntimeError:
            raise
        except Exception as exc:
            logger.warning("[Hub] attempt=%d exception: %s: %s", attempt, type(exc).__name__, exc)
        time.sleep(2)
    raise RuntimeError(f"Selenium Hub tại {hub_url} không sẵn sàng sau {timeout}s (thử {attempt} lần)")


def _create_driver(headless: bool = False):
    """Tạo Selenium Remote WebDriver kết nối đến Hub."""
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    if not settings.SELENIUM_HUB_URL:
        raise RuntimeError(
            "SELENIUM_HUB_URL chưa cấu hình. Thêm vào .env trước khi quét traffic."
        )

    logger.info("[Driver] Kết nối Selenium Hub: %s (headless=%s)", settings.SELENIUM_HUB_URL, headless)
    _wait_for_hub(settings.SELENIUM_HUB_URL)

    opts = Options()
    if headless:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument(f"--user-agent={USER_AGENT}")
    opts.add_argument("--user-data-dir=/home/seluser/selenium")
    opts.add_argument("--profile-directory=Default")

    try:
        driver = webdriver.Remote(
            command_executor=settings.SELENIUM_HUB_URL,
            options=opts,
        )
    except Exception as exc:
        raise RuntimeError(
            f"Không thể tạo Selenium session tại {settings.SELENIUM_HUB_URL}: {exc}"
        ) from exc
    driver.set_page_load_timeout(120)
    driver.maximize_window()
    return driver


def _get_page_title(driver, timeout: int = 10) -> str:
    """Đọc tiêu đề trang h2 đặc trưng của SimilarWeb."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    try:
        el = WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "h2.sc-jhrdCu.duMJhk"))
        )
        return el.text.strip()
    except Exception:
        return ""


def _wait_for_manual(driver, timeout: int = 600) -> None:
    """Chờ user xử lý thủ công qua noVNC (New Device / Password reset)."""
    logger.warning(
        "Cần xử lý thủ công! Mở noVNC: %s  — timeout: %ds",
        settings.NOVNC_URL,
        timeout,
    )
    deadline = time.time() + timeout
    while time.time() < deadline:
        title = _get_page_title(driver, timeout=5)
        if title not in ("New Device Detected", "Set up your new password", ""):
            logger.info("Đã qua màn hình xác thực thủ công, tiếp tục...")
            return
        time.sleep(10)
    raise RuntimeError("Timeout chờ xử lý thủ công qua noVNC")


def _login(driver, email: str, password: str) -> None:
    """Điền form đăng nhập SimilarWeb."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    driver.get(SIMILARWEB_LOGIN_URL)
    WebDriverWait(driver, 20).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )
    time.sleep(random.uniform(1, 2))

    email_input = WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "#input-email"))
    )
    email_input.clear()
    email_input.send_keys(email)
    time.sleep(random.uniform(1, 2))

    pw_input = driver.find_element(By.CSS_SELECTOR, "#input-password")
    pw_input.clear()
    pw_input.send_keys(password)
    time.sleep(random.uniform(1, 2))

    submit_btn = driver.find_element(
        By.CSS_SELECTOR, '[data-automation-name="submit-button"]'
    )
    submit_btn.click()
    time.sleep(10)


def _ensure_session(driver, email: str, password: str) -> None:
    """Điều hướng tới Pro, xử lý các màn hình sau login."""
    from selenium.webdriver.support.ui import WebDriverWait

    driver.get(SIMILARWEB_PRO_URL)
    WebDriverWait(driver, 30).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )

    title = _get_page_title(driver)
    logger.info("SimilarWeb page title: %r", title)

    if title == "Log In to Similarweb Platform":
        _login(driver, email, password)
        title = _get_page_title(driver)

    if title in ("New Device Detected", "Set up your new password"):
        _wait_for_manual(driver)


def _extract_cookie_string(driver) -> str:
    """Trích xuất chuỗi cookie cần thiết từ browser."""
    cookies = driver.get_cookies()
    d = {c["name"]: c.get("value", "") for c in cookies}
    return ";".join(f"{n}={d[n]}" for n in COOKIE_FIELDS if n in d)


def refresh_cookie_blocking(headless: bool = False) -> str:
    """BLOCKING — Dùng Selenium để login SimilarWeb Pro và lấy cookie mới.

    Gọi từ async context qua ``await asyncio.to_thread(refresh_cookie_blocking)``.
    """
    email = settings.SIMILARWEB_EMAIL
    password = settings.SIMILARWEB_PASSWORD
    if not email or not password:
        raise RuntimeError(
            "SIMILARWEB_EMAIL / SIMILARWEB_PASSWORD chưa cấu hình trong .env"
        )

    driver = _create_driver(headless)
    try:
        _ensure_session(driver, email, password)
        cookie = _extract_cookie_string(driver)
        if not cookie:
            raise RuntimeError("Không trích xuất được cookie sau khi login SimilarWeb")
        _save_cookie(cookie)
        logger.info("SimilarWeb cookie refresh thành công")
        return cookie
    finally:
        driver.quit()
