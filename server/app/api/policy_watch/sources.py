"""Nguồn chính sách cần theo dõi — đa nền tảng (Google Ads, Meta, TikTok).

mode:
- "http":   tải nhanh bằng httpx (đủ cho trang server-render như Google Support).
- "render": render JS bằng patchright (cần cho Meta/TikTok — chặn bot / SPA).
"""

from __future__ import annotations

# Mỗi nguồn: url, platform (nhãn nhóm), mode (http | render)
POLICY_SOURCES: list[dict[str, str]] = [
    # ── Google Ads ──
    {"url": "https://support.google.com/adspolicy/answer/6008942?hl=en", "platform": "Google Ads", "mode": "http"},
    {"url": "https://support.google.com/adspolicy/topic/1626336?hl=en", "platform": "Google Ads", "mode": "http"},
    {"url": "https://support.google.com/adspolicy/answer/6020955?hl=en", "platform": "Google Ads", "mode": "http"},
    {"url": "https://support.google.com/adspolicy/answer/6020954?hl=en", "platform": "Google Ads", "mode": "http"},
    {"url": "https://support.google.com/adspolicy/answer/6020956?hl=en", "platform": "Google Ads", "mode": "http"},
    {"url": "https://support.google.com/adspolicy/answer/176031?hl=en", "platform": "Google Ads", "mode": "http"},
    # ── Meta (Facebook/Instagram) ── chặn bot httpx → render bằng browser
    {"url": "https://transparency.meta.com/policies/ad-standards/", "platform": "Meta", "mode": "render"},
    # ── TikTok ── SPA/JS → render; trang ads help đôi khi server-render nên để http
    {"url": "https://www.tiktok.com/community-guidelines/en/", "platform": "TikTok", "mode": "render"},
    {"url": "https://ads.tiktok.com/help/article/tiktok-advertising-policies-ad-creatives-landing-page?lang=en", "platform": "TikTok", "mode": "http"},
]
