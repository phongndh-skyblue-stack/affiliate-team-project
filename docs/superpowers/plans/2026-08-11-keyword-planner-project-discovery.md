# Keyword Planner Project Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Keyword Planner into a Google Ads-style discovery workspace that classifies keyword opportunities and saves URL-optional candidate projects which can later be promoted into Projects.

**Architecture:** Keep the current Keyword Planner Google Ads integration and add a pure scoring/classification module plus candidate-project persistence inside the same backend domain. Expose user-scoped REST endpoints and split the client into focused research, result-table, and saved-candidate components while keeping `KeywordPlannerTab` as the coordinator.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, Pydantic 2, Python `unittest`, Next.js 16, React 19, TypeScript, Tailwind CSS, Recharts, Axios, Sonner.

## Global Constraints

- Reuse delegated Google Ads accounts and never expose refresh/access tokens to the client.
- Do not create campaigns, mutate Google Ads account state, publish ads, or spend budget.
- Candidate projects may exist without a URL; promotion requires a valid HTTP(S) URL.
- Existing Keyword Planner jobs, results, affiliate projects, and API request behavior remain compatible.
- All candidate operations and job-result reads must be scoped to the authenticated user.
- Opportunity scores are deterministic decision aids, not profitability promises.
- Preserve the user's existing uncommitted `client/components/features/dashboard/ProjectsTab.tsx` changes.

---

## File Structure

- Create `server/app/api/keyword_planner/classification.py`: pure intent, trend, score, and tier functions.
- Modify `server/app/api/keyword_planner/model.py`: candidate and candidate-keyword ORM entities.
- Modify `server/app/api/keyword_planner/repository.py`: user-scoped candidate persistence.
- Modify `server/app/api/keyword_planner/schema.py`: enriched ideas and candidate request/response contracts.
- Modify `server/app/api/keyword_planner/service.py`: enrichment, candidate lifecycle, and promotion orchestration.
- Modify `server/app/api/keyword_planner/router.py`: candidate REST routes and ownership-safe result access.
- Create `server/migrations/versions/4d2c8f1a9e70_add_keyword_candidate_projects.py`: additive tables and indexes.
- Create `server/tests/test_keyword_planner_classification.py`: pure classification tests.
- Create `server/tests/test_keyword_candidate_service.py`: SQLite-backed service and isolation tests.
- Modify `client/types/keywordPlanner.types.ts`: enriched result and candidate types.
- Modify `client/services/keywordPlanner.service.ts`: candidate API methods.
- Create `client/components/features/dashboard/keyword-planner/keywordPlanner.utils.ts`: client-only filtering, sorting, and formatting helpers.
- Create `client/components/features/dashboard/keyword-planner/KeywordResearchForm.tsx`: account and seed controls.
- Create `client/components/features/dashboard/keyword-planner/KeywordResultsWorkspace.tsx`: summary, filters, table, selection, and save action.
- Create `client/components/features/dashboard/keyword-planner/CandidateProjectsView.tsx`: saved candidate list/detail/edit/promotion UI.
- Modify `client/components/features/dashboard/KeywordPlannerTab.tsx`: coordinator and inner navigation.

---

### Task 1: Deterministic Keyword Classification

**Files:**
- Create: `server/tests/test_keyword_planner_classification.py`
- Create: `server/app/api/keyword_planner/classification.py`

**Interfaces:**
- Produces: `classify_intent(keyword: str) -> str`
- Produces: `calculate_trend(monthly_searches: list[dict]) -> float`
- Produces: `enrich_keyword_ideas(ideas: list[dict]) -> list[dict]`

- [ ] **Step 1: Write failing pure-function tests**

```python
import unittest

from app.api.keyword_planner.classification import (
    calculate_trend,
    classify_intent,
    enrich_keyword_ideas,
)


class KeywordClassificationTests(unittest.TestCase):
    def test_intent_modifiers(self):
        self.assertEqual(classify_intent("best vpn review"), "commercial")
        self.assertEqual(classify_intent("buy vpn discount"), "transactional")
        self.assertEqual(classify_intent("how does vpn work"), "informational")
        self.assertEqual(classify_intent("nordvpn login"), "navigational")
        self.assertEqual(classify_intent("vpn"), "unknown")

    def test_trend_uses_first_and_last_nonzero_month(self):
        values = [{"searches": 100}, {"searches": 120}, {"searches": 150}]
        self.assertAlmostEqual(calculate_trend(values), 0.5)

    def test_enrichment_is_bounded_and_explainable(self):
        ideas = [
            {"keyword": "buy vpn", "avg_monthly_searches": 10000, "competition_index": 20,
             "low_top_page_bid": 1.0, "high_top_page_bid": 3.0,
             "monthly_searches": [{"searches": 500}, {"searches": 750}]},
            {"keyword": "vpn meaning", "avg_monthly_searches": 100, "competition_index": None,
             "low_top_page_bid": None, "high_top_page_bid": None, "monthly_searches": []},
        ]
        enriched = enrich_keyword_ideas(ideas)
        self.assertTrue(all(0 <= row["opportunity_score"] <= 100 for row in enriched))
        self.assertIn(enriched[0]["opportunity_tier"], {"high", "medium", "low"})
        self.assertTrue(enriched[0]["score_explanation"])
```

- [ ] **Step 2: Run the test and confirm import failure**

Run: `cd server; python -m unittest tests.test_keyword_planner_classification -v`

Expected: FAIL because `classification.py` does not exist.

- [ ] **Step 3: Implement scoring and classification**

Implement modifier sets for the five intents, a bounded first-to-last trend calculation, min-max normalization across the returned ideas, neutral `0.5` values for missing metrics, and the exact score formula `volume*45 + inverse_competition*25 + bid*20 + trend*10`. Return `intent`, `opportunity_score`, `opportunity_tier`, `trend_percentage`, and `score_explanation` on each copied idea dictionary.

- [ ] **Step 4: Run classification tests**

Run: `cd server; python -m unittest tests.test_keyword_planner_classification -v`

Expected: all tests PASS.

- [ ] **Step 5: Commit the isolated unit**

```bash
git add server/app/api/keyword_planner/classification.py server/tests/test_keyword_planner_classification.py
git commit -m "feat: classify keyword planner opportunities"
```

---

### Task 2: Candidate Persistence and Migration

**Files:**
- Modify: `server/app/api/keyword_planner/model.py`
- Modify: `server/app/api/keyword_planner/repository.py`
- Create: `server/migrations/versions/4d2c8f1a9e70_add_keyword_candidate_projects.py`
- Create: `server/tests/test_keyword_candidate_service.py`

**Interfaces:**
- Produces ORM types: `KeywordCandidateProject`, `KeywordCandidateItem`
- Produces repository methods: `create_candidate`, `list_candidates`, `get_candidate_for_user`, `replace_candidate_items`, `delete_candidate`

- [ ] **Step 1: Write failing SQLite persistence tests**

Create an in-memory SQLite engine, create `User`, `KeywordPlannerJob`, `KeywordPlannerResult`, `AffiliateLink`, and new candidate tables, then assert:

```python
candidate = repo.create_candidate(
    user_id="user-a", name="VPN opportunity", description="Research",
    status="new", notes="", tags=["saas"], language_id=1000,
    location_ids=[2840], source_ads_id="123", source_job_id=None, website_url=None,
)
repo.replace_candidate_items(candidate, [
    {"keyword": "best vpn", "normalized_keyword": "best vpn", "avg_monthly_searches": 1000,
     "competition": "Trung bình", "competition_index": 50, "low_top_page_bid": 1.2,
     "high_top_page_bid": 3.4, "monthly_searches": [], "inferred_intent": "commercial",
     "manual_intent": None, "opportunity_score": 72, "opportunity_tier": "medium",
     "score_explanation": "Volume 45/45", "notes": "", "tags": []}
])
self.assertEqual(repo.get_candidate_for_user(candidate.id, "user-a").items[0].keyword, "best vpn")
self.assertIsNone(repo.get_candidate_for_user(candidate.id, "user-b"))
```

- [ ] **Step 2: Run the persistence test and confirm missing model failure**

Run: `cd server; python -m unittest tests.test_keyword_candidate_service.CandidateRepositoryTests -v`

Expected: FAIL because candidate ORM types and repository methods do not exist.

- [ ] **Step 3: Add candidate ORM models**

Add `keyword_candidate_projects` with user ownership, optional `affiliate_project_id`, metadata, JSON tags/location IDs, source IDs, website URL, and timestamps. Add `keyword_candidate_items` with snapshot metrics, classification, notes/tags, timestamps, cascade relationship, and `UniqueConstraint("candidate_id", "normalized_keyword")`.

- [ ] **Step 4: Add focused repository methods**

Implement only SQLAlchemy queries and mutations. Every read/update/delete query accepts `user_id`; load items using `selectinload`; normalize duplicates before inserting item snapshots.

- [ ] **Step 5: Generate and review the Alembic migration**

Run: `cd server; alembic revision --autogenerate -m "add keyword candidate projects"`

Confirm the migration only creates the two candidate tables, their foreign keys, unique constraint, and indexes. It must not drop or rewrite existing tables.

- [ ] **Step 6: Run persistence tests**

Run: `cd server; python -m unittest tests.test_keyword_candidate_service.CandidateRepositoryTests -v`

Expected: PASS.

- [ ] **Step 7: Commit persistence**

```bash
git add server/app/api/keyword_planner/model.py server/app/api/keyword_planner/repository.py server/migrations/versions server/tests/test_keyword_candidate_service.py
git commit -m "feat: persist keyword candidate projects"
```

---

### Task 3: Candidate Service, Promotion, and REST API

**Files:**
- Modify: `server/app/api/keyword_planner/schema.py`
- Modify: `server/app/api/keyword_planner/service.py`
- Modify: `server/app/api/keyword_planner/router.py`
- Modify: `server/tests/test_keyword_candidate_service.py`

**Interfaces:**
- Produces service methods: `create_candidate(user_id, payload)`, `list_candidates(user_id, status, skip, limit)`, `get_candidate(candidate_id, user_id)`, `update_candidate(candidate_id, user_id, payload)`, `delete_candidate(candidate_id, user_id)`, `promote_candidate(candidate_id, user_id, website_url)`
- Produces endpoints under `/keyword-planner/candidates`

- [ ] **Step 1: Add failing service tests**

Cover candidate creation from explicit keyword snapshots, invalid status rejection, cross-user 404 behavior, duplicate keyword collapse, URL-required promotion, promotion idempotency, and preservation of candidate items after promotion. Patch affiliate project creation at the service boundary so tests do not call external providers.

- [ ] **Step 2: Run tests and confirm missing schema/service failures**

Run: `cd server; python -m unittest tests.test_keyword_candidate_service.CandidateServiceTests -v`

Expected: FAIL on missing candidate request/response types and methods.

- [ ] **Step 3: Add Pydantic contracts**

Define `CandidateKeywordInput`, `CandidateCreateRequest`, `CandidateUpdateRequest`, `CandidatePromoteRequest`, `CandidateKeywordResponse`, `CandidateResponse`, and `CandidateListResponse`. Validate candidate statuses against `new|researching|promising|rejected|promoted`, require a trimmed name, cap tags at 20 and keyword items at 500, and normalize optional URLs with the existing HTTP(S) validator.

- [ ] **Step 4: Enrich existing Keyword Planner responses**

Extend `KeywordIdeaItem` with optional backward-compatible fields: `intent`, `opportunity_score`, `opportunity_tier`, `trend_percentage`, and `score_explanation`. Call `enrich_keyword_ideas` in both live scan responses and stored job-result responses. Fix `get_job_results` so it verifies `job.user_id == current_user.id`.

- [ ] **Step 5: Implement candidate service methods**

Keep status transitions explicit, preserve a manual intent override, commit candidate creation/update atomically, translate missing ownership into 404, and use the existing `AffiliateDataService.create_affiliate_link` behavior for promotion. If the candidate already has `affiliate_project_id`, return it without creating a duplicate.

- [ ] **Step 6: Add authenticated routes**

Add:

```text
POST   /keyword-planner/candidates
GET    /keyword-planner/candidates
GET    /keyword-planner/candidates/{candidate_id}
PATCH  /keyword-planner/candidates/{candidate_id}
DELETE /keyword-planner/candidates/{candidate_id}
POST   /keyword-planner/candidates/{candidate_id}/promote
```

- [ ] **Step 7: Run all server candidate and classification tests**

Run: `cd server; python -m unittest tests.test_keyword_planner_classification tests.test_keyword_candidate_service -v`

Expected: PASS.

- [ ] **Step 8: Commit the API unit**

```bash
git add server/app/api/keyword_planner/schema.py server/app/api/keyword_planner/service.py server/app/api/keyword_planner/router.py server/tests
git commit -m "feat: expose keyword candidate project API"
```

---

### Task 4: Client Contracts and Pure Workspace Utilities

**Files:**
- Modify: `client/types/keywordPlanner.types.ts`
- Modify: `client/services/keywordPlanner.service.ts`
- Create: `client/components/features/dashboard/keyword-planner/keywordPlanner.utils.ts`

**Interfaces:**
- Produces: `CandidateProject`, `CandidateKeyword`, candidate request types, and service CRUD methods.
- Produces: `filterKeywordIdeas`, `sortKeywordIdeas`, `summarizeKeywordIdeas`, and display-format helpers.

- [ ] **Step 1: Add enriched and candidate TypeScript contracts**

Mirror the backend camel-case responses. Keep new enrichment fields optional on `KeywordIdeaItem` so stored or older responses remain renderable.

- [ ] **Step 2: Add candidate service calls**

Implement `createCandidate`, `listCandidates`, `getCandidate`, `updateCandidate`, `deleteCandidate`, and `promoteCandidate` using the six authenticated endpoints.

- [ ] **Step 3: Implement pure client utilities**

Create typed filters for query, intents, competition levels, tiers, minimum volume, and maximum CPC. Add stable sorting for score, volume, competition, CPC, trend, and alphabetic order. Summary output must include count, total volume, median volume, average competition index, and the highest-scored keyword.

- [ ] **Step 4: Type-check with the production build**

Run: `cd client; npm run build`

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit contracts and utilities**

```bash
git add client/types/keywordPlanner.types.ts client/services/keywordPlanner.service.ts client/components/features/dashboard/keyword-planner/keywordPlanner.utils.ts
git commit -m "feat: add keyword discovery client contracts"
```

---

### Task 5: Google Ads-Style Research and Results Workspace

**Files:**
- Create: `client/components/features/dashboard/keyword-planner/KeywordResearchForm.tsx`
- Create: `client/components/features/dashboard/keyword-planner/KeywordResultsWorkspace.tsx`
- Modify: `client/components/features/dashboard/KeywordPlannerTab.tsx`

**Interfaces:**
- `KeywordResearchForm` receives accounts, loading state, and `onSubmit(request)`.
- `KeywordResultsWorkspace` receives enriched results and `onSave(selectedItems)`.
- `KeywordPlannerTab` owns data loading, current job, selections, and view navigation.

- [ ] **Step 1: Extract the existing scan controls without behavior changes**

Move account, project, input-mode, language, URL, keyword, and result-limit controls into `KeywordResearchForm`. Preserve current request payload behavior and Vietnamese validation messages.

- [ ] **Step 2: Build the responsive results workspace**

Add summary cards, sticky filter toolbar, sortable result table, row checkboxes, select-all-for-filtered-results, expandable monthly trend details, and a sticky bulk-action bar. Use opportunity tier text alongside color, show score explanations, and keep the keyword/checkbox visible on narrow screens.

- [ ] **Step 3: Add save-candidate dialog**

The dialog requires a name and allows description, notes, tags, status, and optional URL. It snapshots only selected keywords and sends the current job/account/language/location source context.

- [ ] **Step 4: Preserve history behavior**

Keep the existing recent jobs view, but opening a job loads enriched results into the main workspace instead of a detached drawer. Distinguish no account, no search, no provider results, and filtered-empty states.

- [ ] **Step 5: Lint and build**

Run: `cd client; npm run lint`

Run: `cd client; npm run build`

Expected: both succeed.

- [ ] **Step 6: Commit the research workspace**

```bash
git add client/components/features/dashboard/KeywordPlannerTab.tsx client/components/features/dashboard/keyword-planner
git commit -m "feat: redesign keyword planner discovery workspace"
```

---

### Task 6: Saved Candidates and Promotion UI

**Files:**
- Create: `client/components/features/dashboard/keyword-planner/CandidateProjectsView.tsx`
- Modify: `client/components/features/dashboard/KeywordPlannerTab.tsx`

**Interfaces:**
- `CandidateProjectsView` loads candidate list/detail and exposes refresh/navigation callbacks.
- Promotion accepts a URL and returns the linked affiliate project ID.

- [ ] **Step 1: Add inner navigation**

Add `Khám phá từ khóa` and `Dự án tiềm năng` views with candidate count. Preserve the existing outer Google Ads navigation and Mail Authorization tab.

- [ ] **Step 2: Build candidate list and detail**

Support status, tag, market, and date filtering; show aggregate keyword count, total volume, strongest score, tags, status, and last update. The detail view supports editing metadata, individual/bulk intent changes, notes, tags, and removal of saved keywords.

- [ ] **Step 3: Build promotion flow**

Require and validate an HTTP(S) URL, explain that the candidate will remain as history, call `promoteCandidate`, mark the candidate as promoted, and offer navigation to the existing Projects tab using the dashboard's tab-change event convention.

- [ ] **Step 4: Add destructive-action confirmation**

Candidate deletion uses the existing alert-dialog component and clearly states that only saved candidate research is deleted; Google Ads data and promoted Projects are not deleted.

- [ ] **Step 5: Lint and build**

Run: `cd client; npm run lint`

Run: `cd client; npm run build`

Expected: both succeed.

- [ ] **Step 6: Commit saved candidates**

```bash
git add client/components/features/dashboard/KeywordPlannerTab.tsx client/components/features/dashboard/keyword-planner/CandidateProjectsView.tsx
git commit -m "feat: manage keyword candidate projects"
```

---

### Task 7: Migration, Regression, and Browser Verification

**Files:**
- Review: all changed files
- Modify only files implicated by verification failures.

**Interfaces:**
- Consumes all prior tasks.
- Produces a verified end-to-end feature with no external Google Ads mutations.

- [ ] **Step 1: Validate migration from the current database head**

Run: `cd server; alembic upgrade head`

Run the configured database revision query and confirm it matches `alembic heads`.

- [ ] **Step 2: Run server tests and compile checks**

Run: `cd server; python -m unittest discover -s tests -v`

Run: `cd server; python -m compileall app`

Expected: PASS with no syntax errors.

- [ ] **Step 3: Run client verification**

Run: `cd client; npm run lint`

Run: `cd client; npm run build`

Expected: PASS.

- [ ] **Step 4: Run local browser smoke test**

Start the existing server and client using the repository's documented commands. In the local app, verify delegated-account loading, research validation, live or stored job rendering, filters, selection, candidate save/edit, and URL promotion. Do not create campaigns or mutate Google Ads account state.

- [ ] **Step 5: Check worktree scope**

Run: `git status --short`

Run: `git diff --check HEAD`

Confirm the pre-existing `ProjectsTab.tsx` user change is preserved and `.superpowers/` mockup artifacts are not committed.

- [ ] **Step 6: Commit verification fixes if required**

```bash
git add server/app/api/keyword_planner server/tests server/migrations/versions/4d2c8f1a9e70_add_keyword_candidate_projects.py client/types/keywordPlanner.types.ts client/services/keywordPlanner.service.ts client/components/features/dashboard/KeywordPlannerTab.tsx client/components/features/dashboard/keyword-planner
git commit -m "fix: verify keyword discovery workflow"
```
