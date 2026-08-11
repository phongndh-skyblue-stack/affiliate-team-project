import os
import unittest

os.environ["DEBUG"] = "false"

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.affiliate_data.model import AffiliateLink  # noqa: F401
from app.api.auth.model import User  # noqa: F401
from app.api.keyword_planner.model import KeywordCandidateItem, KeywordCandidateProject
from app.api.keyword_planner.repository import KeywordCandidateRepository
from app.core.database import Base


class CandidateRepositoryTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.repo = KeywordCandidateRepository(self.db)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_candidate_items_are_saved_and_reads_are_user_scoped(self):
        candidate = self.repo.create_candidate(
            user_id="user-a",
            name="VPN opportunity",
            description="Research",
            status="new",
            notes="",
            tags=["saas"],
            language_id=1000,
            location_ids=[2840],
            source_ads_id="123",
            source_job_id=None,
            website_url=None,
        )
        self.repo.replace_candidate_items(
            candidate,
            [
                {
                    "keyword": "Best VPN",
                    "avg_monthly_searches": 1000,
                    "competition": "Trung bình",
                    "competition_index": 50,
                    "low_top_page_bid": 1.2,
                    "high_top_page_bid": 3.4,
                    "monthly_searches": [],
                    "inferred_intent": "commercial",
                    "manual_intent": None,
                    "opportunity_score": 72,
                    "opportunity_tier": "medium",
                    "score_explanation": "Nhu cầu 30/45",
                    "notes": "",
                    "tags": [],
                }
            ],
        )
        self.db.commit()

        owned = self.repo.get_candidate_for_user(candidate.id, "user-a")
        foreign = self.repo.get_candidate_for_user(candidate.id, "user-b")

        self.assertIsNotNone(owned)
        self.assertEqual(owned.items[0].keyword, "Best VPN")
        self.assertEqual(owned.items[0].normalized_keyword, "best vpn")
        self.assertIsNone(foreign)

    def test_replacing_items_collapses_case_insensitive_duplicates(self):
        candidate = self.repo.create_candidate(
            user_id="user-a", name="VPN", description=None, status="new", notes=None,
            tags=[], language_id=1000, location_ids=[], source_ads_id=None,
            source_job_id=None, website_url=None,
        )
        base = {
            "avg_monthly_searches": 100,
            "competition": "Thấp",
            "competition_index": 10,
            "low_top_page_bid": None,
            "high_top_page_bid": None,
            "monthly_searches": [],
            "inferred_intent": "unknown",
            "manual_intent": None,
            "opportunity_score": 50,
            "opportunity_tier": "medium",
            "score_explanation": "Trung lập",
            "notes": None,
            "tags": [],
        }

        self.repo.replace_candidate_items(
            candidate,
            [{**base, "keyword": "VPN"}, {**base, "keyword": " vpn "}],
        )
        self.db.commit()

        saved = self.repo.get_candidate_for_user(candidate.id, "user-a")
        self.assertEqual(len(saved.items), 1)


if __name__ == "__main__":
    unittest.main()
