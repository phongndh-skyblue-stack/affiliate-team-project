"""Test logic hash/diff của Policy Watch (thuần, không gọi mạng)."""

from __future__ import annotations

from app.api.policy_watch.service import (
    _content_hash,
    _diff_excerpt,
    _summarize_diff,
)


def test_hash_is_stable_and_sensitive():
    a = "Google Ads policy line 1\nline 2"
    assert _content_hash(a) == _content_hash(a)  # ổn định
    assert _content_hash(a) != _content_hash(a + " thay đổi")  # nhạy với thay đổi


def test_diff_excerpt_captures_added_and_removed():
    old = "line a\nline b\nline c"
    new = "line a\nline B MODIFIED\nline c\nline d"
    excerpt = _diff_excerpt(old, new)
    assert "+line B MODIFIED" in excerpt or "+line d" in excerpt
    assert "-line b" in excerpt


def test_diff_excerpt_empty_when_no_change():
    text = "same\ncontent"
    assert _diff_excerpt(text, text) == ""


def test_summarize_counts_changes():
    excerpt = "+added one\n+added two\n-removed one"
    summary = _summarize_diff(excerpt)
    assert "2" in summary  # 2 dòng thêm
    assert "1" in summary  # 1 dòng xóa
