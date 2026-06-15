"""Test thuật toán chấm điểm SEO (deterministic, không cần DB/mạng)."""

from __future__ import annotations

from app.api.seo_content.schema import SeoScoreRequest
from app.api.seo_content.service import SeoContentService


def _score(**kwargs) -> "object":
    # calculate_seo_score không dùng repository → truyền db=None là đủ
    service = SeoContentService(db=None)  # type: ignore[arg-type]
    return service.calculate_seo_score(SeoScoreRequest(**kwargs))


def test_empty_input_scores_zero_with_warnings():
    res = _score()
    assert res.score == 0
    assert any("trống" in w or "từ khóa" in w for w in res.warnings)


def test_optimal_content_scores_high():
    res = _score(
        seo_title="Elfsight Widgets - Best Website Widget Builder Tool",  # ~50 ký tự
        meta_description=(
            "Add 90+ powerful no-code widgets to any website easily. "
            "Boost reviews, chat and social feeds. Start free today now!"
        ),  # ~120-160
        headlines=["Elfsight: 90+ Widgets", "Elfsight: No Code", "Elfsight: Free Plan"],
        descriptions=["Best widgets for any site", "Boost conversions fast easily"],
        keywords=["elfsight widgets", "website widgets"],
        body_content=(
            "Elfsight widgets help any website owner. "
            "Website widgets from Elfsight widgets boost engagement. " * 8
        ),
    )
    assert res.score >= 60
    assert res.score <= 100


def test_score_is_bounded_0_100():
    res = _score(
        seo_title="x" * 200,
        meta_description="y" * 400,
        keywords=["z"],
        body_content="z " * 500,
    )
    assert 0 <= res.score <= 100


def test_keyword_breakdown_detects_location():
    res = _score(
        seo_title="Elfsight Widgets",
        meta_description="The best elfsight widgets",
        keywords=["elfsight widgets"],
        body_content="elfsight widgets are great. " * 5,
    )
    bd = res.keyword_breakdown[0]
    assert bd.keyword == "elfsight widgets"
    assert bd.found_in_title is True
    assert bd.found_in_description is True
    assert bd.found_in_body is True


def test_too_few_headlines_warns():
    res = _score(headlines=["only one"], keywords=["kw"])
    assert any("3 tiêu đề" in w for w in res.warnings)
