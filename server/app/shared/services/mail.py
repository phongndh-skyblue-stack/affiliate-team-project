"""Gmail API sender for mail delegation authorization emails.

Sends HTML emails via the Gmail REST API using OAuth2 refresh_token of the
system's sender account. Runs synchronously — no Celery involved.
"""
from __future__ import annotations

import base64
import email.mime.multipart
import email.mime.text
import ssl
from datetime import datetime
from pathlib import Path

import httpx

from app.core.config import settings

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def send_delegation_email(to: str, auth_url: str, expires_at: datetime) -> None:
    """Send a Google Ads delegation authorization email via Gmail API.

    Args:
        to: Recipient email address (the mail owner being asked to delegate).
        auth_url: Google OAuth authorization URL embedded as the CTA button link.
        expires_at: UTC datetime when the link expires (for display in email).

    Raises:
        RuntimeError: If SEND_MAIL_* environment variables are not configured.
        httpx.HTTPStatusError: If Gmail API returns an error.
    """
    if not all(
        [
            settings.SEND_MAIL_CLIENT_ID,
            settings.SEND_MAIL_CLIENT_SECRET,
            settings.SEND_MAIL_REFRESH_TOKEN,
        ]
    ):
        raise RuntimeError(
            "SEND_MAIL_CLIENT_ID, SEND_MAIL_CLIENT_SECRET, and SEND_MAIL_REFRESH_TOKEN "
            "must be configured to send delegation emails."
        )

    access_token = _refresh_access_token()

    msg = _build_mime_message(to=to, auth_url=auth_url, expires_at=expires_at)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    with _make_client(30) as client:
        resp = client.post(
            GMAIL_SEND_URL,
            json={"raw": raw},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _make_client(timeout: int) -> httpx.Client:
    """Create an httpx Client that ignores a broken SSL_CERT_FILE env var."""
    try:
        import certifi
        ssl_context = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ssl_context = ssl.create_default_context()
    return httpx.Client(timeout=timeout, verify=ssl_context)


def _refresh_access_token() -> str:
    """Get a fresh access token for the sender Gmail account using stored refresh_token."""
    with _make_client(15) as client:
        resp = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.SEND_MAIL_CLIENT_ID,
                "client_secret": settings.SEND_MAIL_CLIENT_SECRET,
                "refresh_token": settings.SEND_MAIL_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


def _build_mime_message(
    to: str, auth_url: str, expires_at: datetime
) -> email.mime.multipart.MIMEMultipart:
    """Build MIME multipart message for delegation email."""
    # Format expires_at in GMT+7 display (still store in UTC, just display +7)
    from_addr = settings.SEND_MAIL_FROM or settings.SEND_MAIL_CLIENT_ID

    # Convert UTC → +7 for display
    from datetime import timezone, timedelta

    vn_offset = timedelta(hours=7)
    vn_tz = timezone(vn_offset)
    expires_vn = expires_at.astimezone(vn_tz) if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc).astimezone(vn_tz)
    expires_str = expires_vn.strftime("%H:%M • %d/%m/%Y (GMT+7)")

    html_body = f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#1a73e8;padding:28px 40px;">
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">
              Xác nhận ủy quyền Google Ads
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
              Bạn nhận được yêu cầu ủy quyền truy cập tài khoản <strong>Google Ads</strong> của địa chỉ email này.
            </p>
            <p style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.6;">
              Nhấn nút bên dưới để đăng nhập Google và xác nhận ủy quyền:
            </p>
            <a href="{auth_url}"
               style="display:inline-block;background:#1a73e8;color:#fff;
                      padding:13px 28px;border-radius:5px;text-decoration:none;
                      font-size:15px;font-weight:600;">
              Xác nhận ủy quyền
            </a>
            <p style="margin:28px 0 0;color:#888;font-size:13px;">
              ⏰ Link hết hạn lúc: <strong style="color:#555;">{expires_str}</strong>
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="margin:0;color:#aaa;font-size:12px;line-height:1.6;">
              Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.
              Không có hành động nào được thực hiện nếu bạn không nhấn nút trên.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg = email.mime.multipart.MIMEMultipart("alternative")
    msg["Subject"] = "Confirmation Request: Google Ads Account Delegation"
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(email.mime.text.MIMEText(html_body, "html", "utf-8"))
    return msg
