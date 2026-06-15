"""Test hậu kiểm RSA + parse output của Research AI (logic thuần)."""

from __future__ import annotations

import pytest

from app.api.seo_content.ai_research import (
    _enforce_ads_constraints,
    _parse_gemini_output,
)


def test_enforce_prefixes_brand_to_headlines():
    data = {"headlines": ["90+ No-Code Widgets", "Best Add-ons"], "descriptions": []}
    out = _enforce_ads_constraints(data, "Elfsight")
    assert all(h.startswith("Elfsight: ") for h in out["headlines"])


def test_enforce_keeps_existing_brand_prefix():
    data = {"headlines": ["Elfsight: Free Plan"], "descriptions": []}
    out = _enforce_ads_constraints(data, "Elfsight")
    assert out["headlines"] == ["Elfsight: Free Plan"]


def test_enforce_drops_headlines_over_30_chars():
    long_hl = "Elfsight: " + "x" * 40  # > 30 ký tự
    data = {"headlines": [long_hl, "Elfsight: OK"], "descriptions": []}
    out = _enforce_ads_constraints(data, "Elfsight")
    assert all(len(h) <= 30 for h in out["headlines"])
    assert "Elfsight: OK" in out["headlines"]


def test_enforce_dedups_and_caps_15_headlines():
    data = {
        "headlines": [f"Elfsight: V{i}" for i in range(20)] + ["Elfsight: V1"],
        "descriptions": [],
    }
    out = _enforce_ads_constraints(data, "Elfsight")
    assert len(out["headlines"]) <= 15
    assert len(out["headlines"]) == len(set(out["headlines"]))


def test_enforce_drops_descriptions_over_90_and_caps_4():
    data = {
        "headlines": [],
        "descriptions": ["x" * 91, "ok one", "ok two", "ok three", "ok four", "ok five"],
    }
    out = _enforce_ads_constraints(data, "Brand")
    assert all(len(d) <= 90 for d in out["descriptions"])
    assert len(out["descriptions"]) <= 4


def test_parse_strips_markdown_fences():
    raw = '```json\n{"seo_title": "Hello", "keywords": ["a"]}\n```'
    parsed = _parse_gemini_output(raw)
    assert parsed["seo_title"] == "Hello"
    assert parsed["keywords"] == ["a"]


def test_parse_extracts_json_among_text():
    raw = 'Đây là kết quả: {"a": 1} . Hết.'
    assert _parse_gemini_output(raw)["a"] == 1


def test_parse_raises_when_no_json():
    with pytest.raises(ValueError):
        _parse_gemini_output("không có json ở đây")
