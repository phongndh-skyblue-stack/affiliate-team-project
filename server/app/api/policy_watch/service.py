"""Theo dõi chính sách quảng cáo đa nền tảng (Google Ads, Meta, TikTok).

Định kỳ (cron hàng giờ qua ARQ) tải các trang chính sách, so sánh với bản chụp
trước đó; nếu nội dung thay đổi thì lưu sự kiện và thông báo cho toàn bộ user
(chuông hệ thống + Socket.IO + Telegram).

- Nguồn http (Google): tải nhanh bằng httpx.
- Nguồn render (Meta/TikTok): render JS bằng patchright để vượt chặn bot / SPA.
"""

from __future__ import annotations

import difflib
import hashlib
import logging
import re

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth.model import User
from app.api.notifications.service import NotificationService
from app.api.policy_watch.model import PolicyChangeEvent, PolicyWatchSnapshot
from app.api.policy_watch.sources import POLICY_SOURCES
from app.api.telegram.model import TelegramSubscription
from app.api.telegram.notifications import send_telegram_message
from app.shared.utils import utc_now
from app.shared.ws_manager import emit_to_user

logger = logging.getLogger(__name__)

_DIFF_EXCERPT_MAX_LINES = 40
# Dòng thuần số ≥8 chữ số = render/session ID động của trang Google support
_DYNAMIC_TOKEN_RE = re.compile(r"\d{8,}")
_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
# Text ngắn hơn ngưỡng này = tải lỗi/trang rỗng → bỏ qua chu kỳ, tránh báo giả
_MIN_CONTENT_LENGTH = 250


def _html_to_text(html: str, url: str) -> tuple[str, str]:
    """Chuyển HTML → (title, text đã chuẩn hóa) — dùng chung cho http & render."""
    soup = BeautifulSoup(html, "lxml")
    title = (soup.title.get_text(strip=True) if soup.title else "") or url

    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    # Bỏ dòng trống + token thuần số dài (render/session ID động gây false positive)
    lines = [
        ln.strip()
        for ln in text.splitlines()
        if ln.strip() and not _DYNAMIC_TOKEN_RE.fullmatch(ln.strip())
    ]
    return title, "\n".join(lines)


async def _fetch_http(url: str) -> tuple[str, str]:
    """Tải nhanh bằng httpx (trang server-render như Google Support)."""
    async with httpx.AsyncClient(
        timeout=30.0, follow_redirects=True, headers={"User-Agent": _USER_AGENT}
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
    return _html_to_text(resp.text, url)


async def _fetch_render(url: str) -> tuple[str, str]:
    """Render JS bằng patchright (Meta/TikTok chặn bot / SPA)."""
    from patchright.async_api import async_playwright

    playwright = browser = None
    try:
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page(user_agent=_USER_AGENT)
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(3500)  # chờ JS render nội dung chính
        html = await page.content()
        return _html_to_text(html, url)
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()


async def _fetch_source(source: dict) -> tuple[str, str]:
    """Dispatch theo mode của nguồn."""
    if source.get("mode") == "render":
        return await _fetch_render(source["url"])
    return await _fetch_http(source["url"])


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _diff_excerpt(old: str, new: str) -> str:
    diff = difflib.unified_diff(
        old.splitlines(), new.splitlines(), lineterm="", n=1
    )
    changed = [ln for ln in diff if ln.startswith(("+", "-")) and not ln.startswith(("+++", "---"))]
    return "\n".join(changed[:_DIFF_EXCERPT_MAX_LINES])


def _summarize_diff(diff_excerpt: str) -> str:
    added = sum(1 for ln in diff_excerpt.splitlines() if ln.startswith("+"))
    removed = sum(1 for ln in diff_excerpt.splitlines() if ln.startswith("-"))
    return f"Phát hiện {added} dòng thêm mới, {removed} dòng bị xóa/sửa trong chính sách."


async def _broadcast_change(db: Session, event: PolicyChangeEvent) -> None:
    """Thông báo cho toàn bộ user: chuông hệ thống + Socket.IO + Telegram."""
    message = f"⚠️ Chính sách {event.platform or 'quảng cáo'} vừa thay đổi"
    description = f"{event.title or event.source_url} — {event.summary or ''}".strip(" —")

    notif_service = NotificationService(db)
    user_ids = list(db.scalars(select(User.id)))
    for user_id in user_ids:
        try:
            notif_service.create(
                user_id=user_id,
                type="policy_change",
                payload={
                    "message": message,
                    "description": description,
                    "platform": event.platform,
                    "sourceUrl": event.source_url,
                    "eventId": event.id,
                },
            )
            await emit_to_user(
                user_id,
                "policy_change",
                {
                    "type": "policy_change",
                    "message": message,
                    "description": description,
                    "platform": event.platform,
                    "sourceUrl": event.source_url,
                    "createdAt": event.detected_at.isoformat(),
                },
            )
        except Exception as exc:  # noqa: BLE001 — một user lỗi không chặn user khác
            logger.warning("Không gửi được notification policy_change cho user %s: %s", user_id, exc)

    # Telegram broadcast cho các subscription đang bật
    subs = list(
        db.scalars(select(TelegramSubscription).where(TelegramSubscription.enabled == True))  # noqa: E712
    )
    tg_text = f"{message}\n{description}\n{event.source_url}"
    for sub in subs:
        try:
            await send_telegram_message(sub.chat_id, tg_text)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Không gửi được Telegram policy_change tới chat %s: %s", sub.chat_id, exc)


async def check_policy_sources(db: Session) -> dict:
    """Quét toàn bộ nguồn chính sách đa nền tảng.

    Trả về {checked, changed, new_sources, errors}.
    """
    checked = changed = new_sources = 0
    errors: list[str] = []

    for source in POLICY_SOURCES:
        url = source["url"]
        platform = source.get("platform", "Khác")
        try:
            title, text = await _fetch_source(source)
        except Exception as exc:  # noqa: BLE001 — nguồn lỗi không chặn nguồn khác
            logger.warning("Policy watch: không tải được %s: %s", url, exc)
            errors.append(f"{url}: {exc}")
            continue

        # Lọc trang rỗng/tải lỗi (đặc biệt Meta/TikTok SPA) — tránh báo giả
        if len(text) < _MIN_CONTENT_LENGTH:
            logger.warning("Policy watch: nội dung %s quá ngắn (%d ký tự) — bỏ qua chu kỳ", url, len(text))
            errors.append(f"{url}: nội dung quá ngắn ({len(text)} ký tự)")
            continue

        checked += 1
        digest = _content_hash(text)
        snapshot = db.scalar(
            select(PolicyWatchSnapshot).where(PolicyWatchSnapshot.source_url == url)
        )

        if snapshot is None:
            db.add(
                PolicyWatchSnapshot(
                    source_url=url,
                    platform=platform,
                    title=title,
                    content_hash=digest,
                    content_text=text,
                    fetched_at=utc_now(),
                )
            )
            db.commit()
            new_sources += 1
            logger.info("Policy watch: đã lưu baseline cho %s (%s)", url, platform)
            continue

        # Cập nhật platform nếu thay đổi cấu hình
        if snapshot.platform != platform:
            snapshot.platform = platform

        if snapshot.content_hash == digest:
            snapshot.fetched_at = utc_now()
            db.commit()
            continue

        excerpt = _diff_excerpt(snapshot.content_text, text)
        event = PolicyChangeEvent(
            source_url=url,
            platform=platform,
            title=title,
            summary=_summarize_diff(excerpt),
            diff_excerpt=excerpt,
            detected_at=utc_now(),
        )
        db.add(event)

        snapshot.title = title
        snapshot.content_hash = digest
        snapshot.content_text = text
        snapshot.fetched_at = utc_now()
        snapshot.changed_at = utc_now()
        db.commit()
        db.refresh(event)

        changed += 1
        logger.info("Policy watch: phát hiện thay đổi tại %s (%s)", url, platform)
        await _broadcast_change(db, event)

    return {"checked": checked, "changed": changed, "new_sources": new_sources, "errors": errors}


def list_recent_changes(db: Session, limit: int = 50) -> list[PolicyChangeEvent]:
    stmt = select(PolicyChangeEvent).order_by(PolicyChangeEvent.detected_at.desc()).limit(limit)
    return list(db.scalars(stmt))


def list_snapshots(db: Session) -> list[PolicyWatchSnapshot]:
    stmt = select(PolicyWatchSnapshot).order_by(PolicyWatchSnapshot.source_url)
    return list(db.scalars(stmt))
