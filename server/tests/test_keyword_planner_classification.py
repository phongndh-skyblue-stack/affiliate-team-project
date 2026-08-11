import os
import unittest

os.environ["DEBUG"] = "false"

from app.api.keyword_planner.classification import (
    calculate_trend,
    classify_intent,
    enrich_keyword_ideas,
)


class KeywordClassificationTests(unittest.TestCase):
    def test_classify_intent_uses_keyword_modifiers(self):
        cases = {
            "best vpn review": "commercial",
            "buy vpn discount": "transactional",
            "how does vpn work": "informational",
            "nordvpn login": "navigational",
            "vpn": "unknown",
        }

        for keyword, expected in cases.items():
            with self.subTest(keyword=keyword):
                self.assertEqual(classify_intent(keyword), expected)

    def test_calculate_trend_compares_first_and_last_nonzero_month(self):
        values = [
            {"searches": 0},
            {"searches": 100},
            {"searches": 120},
            {"searches": 150},
        ]

        self.assertAlmostEqual(calculate_trend(values), 0.5)

    def test_calculate_trend_is_neutral_without_enough_history(self):
        self.assertEqual(calculate_trend([]), 0.0)
        self.assertEqual(calculate_trend([{"searches": 100}]), 0.0)

    def test_enrich_keyword_ideas_returns_bounded_explainable_scores(self):
        ideas = [
            {
                "keyword": "buy vpn",
                "avg_monthly_searches": 10000,
                "competition_index": 20,
                "low_top_page_bid": 1.0,
                "high_top_page_bid": 3.0,
                "monthly_searches": [{"searches": 500}, {"searches": 750}],
            },
            {
                "keyword": "vpn meaning",
                "avg_monthly_searches": 100,
                "competition_index": None,
                "low_top_page_bid": None,
                "high_top_page_bid": None,
                "monthly_searches": [],
            },
        ]

        enriched = enrich_keyword_ideas(ideas)

        self.assertEqual(enriched[0]["intent"], "transactional")
        self.assertEqual(enriched[1]["intent"], "unknown")
        self.assertTrue(all(0 <= row["opportunity_score"] <= 100 for row in enriched))
        self.assertTrue(all(row["opportunity_tier"] in {"high", "medium", "low"} for row in enriched))
        self.assertTrue(all(row["score_explanation"] for row in enriched))
        self.assertGreater(enriched[0]["opportunity_score"], enriched[1]["opportunity_score"])


if __name__ == "__main__":
    unittest.main()
