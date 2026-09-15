"""Google OAuth 2.0 + PKCE helper for mail delegation flow.

Generates authorization URLs and exchanges authorization codes for tokens.
No Celery / no background tasks — everything runs synchronously in the request.
"""
from __future__ import annotations

import base64
import hashlib
import secrets
import ssl
import urllib.parse
from typing import TypedDict

import httpx

from app.core.config import settings

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DELEGATION_SCOPES = [
    "https://www.googleapis.com/auth/adwords",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


class TokenResult(TypedDict):
    access_token: str
    refresh_token: str
    email: str


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def generate_authorization_url() -> tuple[str, str, str]:
    """Generate a Google OAuth2 authorization URL with PKCE.

    Returns:
        Tuple of (authorization_url, state, code_verifier).
        - authorization_url: URL to redirect/email to the mail owner.
        - state: Random CSRF token; must be persisted and validated on callback.
        - code_verifier: PKCE verifier; must be stored alongside state.
    """
    state = secrets.token_hex(32)
    code_verifier, code_challenge = _generate_pkce()

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(DELEGATION_SCOPES),
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = GOOGLE_AUTH_URL + "?" + urllib.parse.urlencode(params)
    return auth_url, state, code_verifier


def _make_client(timeout: int) -> httpx.Client:
    """Create an httpx Client that works even if SSL_CERT_FILE env var is broken."""
    try:
        import certifi
        ssl_context = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ssl_context = ssl.create_default_context()
    return httpx.Client(timeout=timeout, verify=ssl_context)


def exchange_code_for_token(code: str, code_verifier: str) -> TokenResult:
    """Exchange OAuth2 authorization code + PKCE verifier for access/refresh tokens.

    Also fetches the authenticated user's email from userinfo endpoint.

    Args:
        code: Authorization code received from Google redirect.
        code_verifier: The PKCE verifier that was generated alongside the state.

    Returns:
        TokenResult with access_token, refresh_token, email.

    Raises:
        httpx.HTTPStatusError: If Google returns an error response.
        KeyError: If the token response is missing expected fields.
    """
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }

    with _make_client(30) as client:
        token_resp = client.post(GOOGLE_TOKEN_URL, data=data)
        token_resp.raise_for_status()
        tokens = token_resp.json()

        userinfo_resp = client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            timeout=10,
        )
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()

    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token", ""),
        "email": userinfo.get("email", ""),
    }


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _generate_pkce() -> tuple[str, str]:
    """Generate PKCE code_verifier and S256 code_challenge."""
    code_verifier = secrets.token_urlsafe(96)  # ~128 chars
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge
