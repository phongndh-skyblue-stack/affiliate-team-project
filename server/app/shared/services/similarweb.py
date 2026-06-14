"""SimilarWeb Pro cookie helper.

The SimilarWeb cookie is cached in Redis with a TTL so all API/worker
processes can share it. Selenium is only used when the Redis cache is empty or
the caller explicitly refreshes a stale cookie.
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
import uuid
from contextlib import suppress

from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)

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
COOKIE_CACHE_KEY = "similarweb:pro:cookie"
COOKIE_REFRESH_LOCK_KEY = "similarweb:pro:cookie:refresh_lock"
COOKIE_REFRESH_WAIT_SECONDS = 120

_redis_client: Redis | None = None
_refresh_lock = asyncio.Lock()


def _get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def get_cookie_from_cache() -> str | None:
    cookie = await _get_redis().get(COOKIE_CACHE_KEY)
    if cookie:
        logger.info("[SW_UTILS] SimilarWeb cookie loaded from Redis cache")
    return cookie


async def _save_cookie(cookie: str) -> None:
    ttl = max(settings.SIMILARWEB_COOKIE_CACHE_TTL_SECONDS, 60)
    await _get_redis().set(COOKIE_CACHE_KEY, cookie, ex=ttl)
    logger.info("[SW_UTILS] SimilarWeb cookie saved to Redis cache, ttl=%ss", ttl)


async def _delete_cookie() -> None:
    await _get_redis().delete(COOKIE_CACHE_KEY)
    logger.info("[SW_UTILS] SimilarWeb cookie cache deleted from Redis")


async def _acquire_refresh_lock(token: str) -> bool:
    ttl = max(settings.SIMILARWEB_COOKIE_REFRESH_LOCK_TTL_SECONDS, 60)
    return bool(await _get_redis().set(COOKIE_REFRESH_LOCK_KEY, token, nx=True, ex=ttl))


async def _release_refresh_lock(token: str) -> None:
    script = """
    if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
    end
    return 0
    """
    await _get_redis().eval(script, 1, COOKIE_REFRESH_LOCK_KEY, token)


async def _wait_for_cookie_from_other_process(stale_cookie: str | None) -> str | None:
    deadline = time.time() + COOKIE_REFRESH_WAIT_SECONDS
    while time.time() < deadline:
        await asyncio.sleep(2)
        current = await get_cookie_from_cache()
        if current and current != stale_cookie:
            logger.info("[SW_UTILS] Using SimilarWeb cookie refreshed by another process")
            return current
    return None


async def refresh_cookie(stale_cookie: str | None = None) -> str:
    """Refresh SimilarWeb cookie, avoiding duplicate Selenium logins."""
    async with _refresh_lock:
        current = await get_cookie_from_cache()
        if current and stale_cookie and current != stale_cookie:
            logger.info("[SW_UTILS] Cookie was refreshed already, using Redis value")
            return current

        lock_token = str(uuid.uuid4())
        acquired = await _acquire_refresh_lock(lock_token)
        if not acquired:
            logger.info("[SW_UTILS] Another process is refreshing SimilarWeb cookie; waiting")
            refreshed = await _wait_for_cookie_from_other_process(stale_cookie)
            if refreshed:
                return refreshed
            logger.warning("[SW_UTILS] Timed out waiting for Redis refresh lock; refreshing locally")

        try:
            await _delete_cookie()
            logger.info("[SW_UTILS] Starting Selenium login to refresh SimilarWeb cookie")
            new_cookie = await asyncio.to_thread(refresh_cookie_blocking, False)
            await _save_cookie(new_cookie)
            return new_cookie
        finally:
            if acquired:
                await _release_refresh_lock(lock_token)


async def get_headers() -> dict[str, str]:
    cookie = await get_cookie_from_cache()
    if not cookie:
        logger.info("[SW_UTILS] Redis cookie cache is empty, refreshing via Selenium")
        cookie = await refresh_cookie()
    return build_headers(cookie)


def build_headers(cookie: str) -> dict[str, str]:
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


def _wait_for_hub(hub_url: str, timeout: int = 30) -> None:
    import httpx as _httpx

    deadline = time.time() + timeout
    status_url = hub_url.rstrip("/").replace("/wd/hub", "") + "/status"
    logger.info("[Hub] Checking Selenium Hub: %s", status_url)
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        try:
            response = _httpx.get(status_url, timeout=3, trust_env=False)
            logger.debug(
                "[Hub] attempt=%d status_code=%d body=%s",
                attempt,
                response.status_code,
                response.text[:300],
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("value", {}).get("ready"):
                    logger.info("[Hub] Selenium Hub ready after %d attempts", attempt)
                    return
                logger.warning("[Hub] Hub responded but ready=false: %s", data)
            elif response.status_code in (301, 302):
                location = response.headers.get("location", "")
                raise RuntimeError(
                    f"Selenium Hub at {hub_url} redirected ({response.status_code}) to {location}. "
                    "Use an https:// SELENIUM_HUB_URL or fix Cloudflare SSL mode."
                )
            elif response.status_code in (502, 503, 520, 521, 522, 523, 524, 525, 526):
                raise RuntimeError(
                    f"Selenium Hub at {hub_url} returned HTTP {response.status_code}. "
                    "Hub may be down or blocked by Cloudflare."
                )
            else:
                logger.warning("[Hub] attempt=%d HTTP %d", attempt, response.status_code)
        except RuntimeError:
            raise
        except Exception as exc:
            logger.warning("[Hub] attempt=%d exception: %s: %s", attempt, type(exc).__name__, exc)
        time.sleep(2)
    raise RuntimeError(f"Selenium Hub at {hub_url} was not ready after {timeout}s ({attempt} attempts)")


def _create_driver(headless: bool = False):
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    if not settings.SELENIUM_HUB_URL:
        raise RuntimeError("SELENIUM_HUB_URL is not configured")

    logger.info("[Driver] Connecting Selenium Hub: %s (headless=%s)", settings.SELENIUM_HUB_URL, headless)
    _wait_for_hub(settings.SELENIUM_HUB_URL)

    def build_options(use_shared_profile: bool) -> Options:
        opts = Options()
        if headless:
            opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument(f"--user-agent={USER_AGENT}")
        if use_shared_profile:
            opts.add_argument("--user-data-dir=/home/seluser/selenium")
            opts.add_argument("--profile-directory=Default")
        return opts

    try:
        driver = webdriver.Remote(
            command_executor=settings.SELENIUM_HUB_URL,
            options=build_options(use_shared_profile=True),
        )
    except Exception as exc:
        logger.warning(
            "[Driver] Shared Chrome profile failed; retrying with a temporary profile: %s",
            exc,
        )
        try:
            driver = webdriver.Remote(
                command_executor=settings.SELENIUM_HUB_URL,
                options=build_options(use_shared_profile=False),
            )
        except Exception as retry_exc:
            raise RuntimeError(
                f"Could not create Selenium session at {settings.SELENIUM_HUB_URL}: {retry_exc}"
            ) from retry_exc

    driver.set_page_load_timeout(120)
    driver.maximize_window()
    return driver


def _get_page_title(driver, timeout: int = 10) -> str:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    try:
        element = WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "h2.sc-jhrdCu.duMJhk"))
        )
        return element.text.strip()
    except Exception:
        return ""


def _wait_for_manual(driver, timeout: int = 30) -> None:
    logger.warning("Manual SimilarWeb action required. Open noVNC: %s, timeout=%ds", settings.NOVNC_URL, timeout)
    deadline = time.time() + timeout
    while time.time() < deadline:
        title = _get_page_title(driver, timeout=5)
        if title not in ("New Device Detected", "Set up your new password", ""):
            logger.info("Manual SimilarWeb verification completed")
            return
        time.sleep(10)
    raise RuntimeError("Timed out waiting for manual SimilarWeb verification via noVNC")


def _login(driver, email: str, password: str) -> None:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    driver.get(SIMILARWEB_LOGIN_URL)
    WebDriverWait(driver, 20).until(lambda d: d.execute_script("return document.readyState") == "complete")
    time.sleep(random.uniform(1, 2))

    email_input = WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.CSS_SELECTOR, "#input-email")))
    email_input.clear()
    email_input.send_keys(email)
    time.sleep(random.uniform(1, 2))

    password_input = driver.find_element(By.CSS_SELECTOR, "#input-password")
    password_input.clear()
    password_input.send_keys(password)
    time.sleep(random.uniform(1, 2))

    submit_button = driver.find_element(By.CSS_SELECTOR, '[data-automation-name="submit-button"]')
    submit_button.click()
    time.sleep(10)


def _ensure_session(driver, email: str, password: str) -> None:
    from selenium.webdriver.support.ui import WebDriverWait

    driver.get(SIMILARWEB_PRO_URL)
    WebDriverWait(driver, 30).until(lambda d: d.execute_script("return document.readyState") == "complete")

    title = _get_page_title(driver)
    logger.info("SimilarWeb page title: %r", title)

    if title == "Log In to Similarweb Platform":
        _login(driver, email, password)
        title = _get_page_title(driver)

    if title in ("New Device Detected", "Set up your new password"):
        _wait_for_manual(driver)


def _extract_cookie_string(driver) -> str:
    cookies = driver.get_cookies()
    cookie_map = {cookie["name"]: cookie.get("value", "") for cookie in cookies}
    return ";".join(f"{name}={cookie_map[name]}" for name in COOKIE_FIELDS if name in cookie_map)


def refresh_cookie_blocking(headless: bool = False) -> str:
    email = settings.SIMILARWEB_EMAIL
    password = settings.SIMILARWEB_PASSWORD
    if not email or not password:
        raise RuntimeError("SIMILARWEB_EMAIL / SIMILARWEB_PASSWORD are not configured")

    driver = _create_driver(headless)
    try:
        _ensure_session(driver, email, password)
        cookie = _extract_cookie_string(driver)
        if not cookie:
            raise RuntimeError("Could not extract SimilarWeb cookie after login")
        logger.info("SimilarWeb cookie refresh succeeded")
        return cookie
    finally:
        with suppress(Exception):
            driver.quit()
