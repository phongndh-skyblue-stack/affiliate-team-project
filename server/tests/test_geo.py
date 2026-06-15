"""Test ánh xạ quốc gia→gl và locale cho Quét quảng cáo."""

from __future__ import annotations

from app.shared.agents.search_ads.services.geo import (
    COUNTRIES,
    LANGUAGES,
    gl_for_location,
    locale_for,
)
from app.shared.agents.search_ads.services.google_search import GoogleSearchService


def test_gl_derives_from_location_not_language():
    # Cùng ngôn ngữ 'en' nhưng location khác nhau → gl phải khác nhau
    g = GoogleSearchService()
    us = g.build_google_search_url("kw", "en", "United States")
    ca = g.build_google_search_url("kw", "en", "Canada")
    au = g.build_google_search_url("kw", "en", "Australia")
    assert "gl=us" in us
    assert "gl=ca" in ca
    assert "gl=au" in au


def test_gl_for_known_countries():
    assert gl_for_location("Germany") == "de"
    assert gl_for_location("Brazil") == "br"
    assert gl_for_location("Vietnam") == "vn"
    assert gl_for_location("United Kingdom") == "uk"


def test_gl_fallback_for_unknown():
    assert gl_for_location("Atlantis") == "us"
    assert gl_for_location("") == "us"
    assert gl_for_location(None) == "us"


def test_locale_combines_language_and_country():
    assert locale_for("de", "Germany") == "de-DE"
    assert locale_for("pt", "Brazil") == "pt-BR"
    assert locale_for("en", "United Kingdom") == "en-GB"
    assert locale_for("vi", "Vietnam") == "vi-VN"


def test_all_countries_have_unique_valid_gl():
    gls = [c["gl"] for c in COUNTRIES]
    assert len(gls) == len(set(gls)), "Có mã gl bị trùng"
    assert all(len(g) == 2 for g in gls), "gl phải là ISO-2"


def test_languages_nonempty():
    assert len(LANGUAGES) >= 10
    assert all(lang["value"] and lang["label"] for lang in LANGUAGES)
