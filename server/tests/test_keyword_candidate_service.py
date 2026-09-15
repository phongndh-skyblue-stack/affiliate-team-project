import os
import unittest

os.environ["DEBUG"] = "false"

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.affiliate_data.model import AffiliateLink  # noqa: F401
from app.api.auth.model import User  # noqa: F401
from app.api.keyword_planner.model import KeywordCandidateItem, KeywordCandidateProject
from app.api.keyword_planner.repository import KeywordCandidateRepository
from app.api.keyword_planner.schema import (
    CandidateCreateRequest,
    CandidateKeywordInput,
    CandidatePromoteRequest,
)
from app.api.keyword_planner.service import KeywordCandidateService, KeywordPlannerService
from app.core.database import Base
from fastapi import HTTPException


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


class CandidateServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.service = KeywordCandidateService(self.db)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    @staticmethod
    def _keyword(keyword: str = "best vpn") -> CandidateKeywordInput:
        return CandidateKeywordInput(
            keyword=keyword,
            avg_monthly_searches=1200,
            competition="Trung bình",
            competition_index=45,
            low_top_page_bid=1.5,
            high_top_page_bid=4.0,
            monthly_searches=[],
            inferred_intent="commercial",
            opportunity_score=78,
            opportunity_tier="high",
            score_explanation="Nhu cầu 35/45",
        )

    def test_create_candidate_collapses_duplicate_keyword_snapshots(self):
        result = self.service.create_candidate(
            "user-a",
            CandidateCreateRequest(
                name="VPN research",
                tags=["saas", "saas"],
                keywords=[self._keyword("Best VPN"), self._keyword(" best vpn ")],
            ),
        )

        self.assertEqual(result.name, "VPN research")
        self.assertEqual(result.tags, ["saas"])
        self.assertEqual(len(result.keywords), 1)

    def test_candidate_detail_is_not_visible_to_another_user(self):
        created = self.service.create_candidate(
            "user-a", CandidateCreateRequest(name="Owned", keywords=[self._keyword()])
        )

        with self.assertRaises(HTTPException) as context:
            self.service.get_candidate(created.id, "user-b")

        self.assertEqual(context.exception.status_code, 404)

    def test_promotion_requires_url_and_is_idempotent(self):
        created = self.service.create_candidate(
            "user-a", CandidateCreateRequest(name="VPN", keywords=[self._keyword()])
        )
        with self.assertRaises(HTTPException) as context:
            self.service.promote_candidate(
                created.id, "user-a", CandidatePromoteRequest(website_url=None)
            )
        self.assertEqual(context.exception.status_code, 400)

        first = self.service.promote_candidate(
            created.id,
            "user-a",
            CandidatePromoteRequest(website_url="https://example.com/affiliate"),
        )
        second = self.service.promote_candidate(
            created.id,
            "user-a",
            CandidatePromoteRequest(website_url="https://example.com/affiliate"),
        )

        self.assertEqual(first.affiliate_project_id, second.affiliate_project_id)
        self.assertEqual(second.status, "promoted")
        self.assertEqual(len(second.keywords), 1)

    def test_job_results_are_user_scoped(self):
        planner = KeywordPlannerService(self.db)
        job = planner.repo.create_job(
            user_id="user-a", ads_id="123", input_type="keywords", keywords=["vpn"],
            page_url=None, use_entire_site=False, language_id=1000,
            location_ids=[], result_limit=10,
        )
        planner.repo.mark_job_done(job)
        self.db.commit()

        with self.assertRaises(HTTPException) as context:
            planner.get_job_results(job.id, "user-b")

        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
