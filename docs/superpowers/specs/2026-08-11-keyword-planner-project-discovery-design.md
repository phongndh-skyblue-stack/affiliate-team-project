# Keyword Planner Project Discovery — Design

## Goal

Turn the existing Google Ads Keyword Planner screen into a project-discovery workspace. Users can research keyword ideas with their delegated Google Ads accounts, classify and compare opportunities, and save selected ideas as candidate projects before they know the final affiliate URL.

## Scope

This feature extends the existing Keyword Planner module and reuses the current Google OAuth, imported Ads accounts, Google Ads API client, keyword jobs, and affiliate project system.

Included:

- A Keyword Planner interface inspired by Google Ads, optimized for repeated research.
- Search by seed keywords, URL, or keyword-and-URL combination.
- Result filtering, sorting, selection, automatic opportunity scoring, and classification.
- Candidate projects that do not require a URL.
- Saved keyword snapshots, notes, tags, market, language, and source Ads account.
- Candidate lifecycle and conversion into an existing affiliate project once a URL is available.
- Search history and saved-project management within the Keyword Planner area.

Not included:

- Creating Google Ads campaigns or changing Ads account state.
- Spending budget or publishing ads.
- AI-generated business recommendations that require a new external provider.
- Replacing the existing Projects workspace.

## User Experience

The Google Ads area keeps its current top-level placement. The Keyword Planner inner tab becomes a two-pane discovery workspace on desktop and a stacked layout on mobile.

### Research pane

The left pane contains:

- Delegated Google Ads account selector.
- Input mode: keywords, URL, or keywords plus URL.
- Seed keywords with paste-friendly line/comma parsing.
- Optional domain or page URL.
- Location, language, and result-limit controls.
- Search action and clear action.

The selected account defaults to the first usable imported account. No OAuth secrets or refresh tokens are exposed to the browser.

### Results workspace

The main pane contains:

- Summary cards for keyword count, total/median search demand, average competition, and strongest opportunity.
- A toolbar for text search, intent, competition, opportunity tier, minimum volume, maximum CPC, sorting, and selection state.
- A dense table with checkbox, keyword, search volume, 12-month trend, competition, bid range, intent, and opportunity score.
- Expandable keyword detail showing monthly history and metric explanations.
- Bulk actions to classify, tag, or save selected keywords as a candidate project.

The default ordering is opportunity score descending. All filters and sorting operate on the returned snapshot, so they remain responsive without additional Google Ads requests.

### Saved candidates

A second inner view, “Dự án tiềm năng”, lists saved candidates as cards or compact rows. It supports filtering by status, tag, market, and date. Opening a candidate shows its metadata, saved keyword snapshot, aggregate metrics, notes, and research source.

Candidate statuses are:

1. `new`
2. `researching`
3. `promising`
4. `rejected`
5. `promoted`

Users may edit metadata, add or remove saved keywords, or promote a candidate after entering a valid URL. Promotion creates or reuses the existing affiliate project record, links the candidate to it, and preserves the candidate and keyword history.

## Classification and Opportunity Score

Classification is deterministic and explainable.

Intent values:

- `informational`
- `commercial`
- `transactional`
- `navigational`
- `unknown`

Initial intent is inferred from keyword modifiers. Users can override it individually or in bulk. Manual overrides are stored and never overwritten by recalculation.

Opportunity score ranges from 0 to 100 and combines normalized signals within the current result set:

- 45% search volume.
- 25% inverse competition index.
- 20% commercial bid signal.
- 10% positive recent trend.

Missing metrics contribute a neutral value instead of zero. The UI shows a short score explanation. Tiers are `high` (75–100), `medium` (45–74), and `low` (0–44). Scores are decision aids, not promises of profitability.

## Data Model

### Candidate project

A new `keyword_candidate_projects` table stores:

- Ownership and optional promoted affiliate-project ID.
- Name and description.
- Status.
- Notes and string tags.
- Market/location IDs and language ID.
- Source Google Ads customer ID and optional source keyword job ID.
- Optional website URL.
- Created and updated timestamps.

### Candidate keywords

A new `keyword_candidate_items` table stores a durable snapshot for each selected keyword:

- Candidate ID and optional original Keyword Planner result ID.
- Keyword text.
- Search volume, competition, competition index, bid range, and monthly history.
- Inferred intent and optional manual intent override.
- Opportunity score, tier, and score explanation.
- Optional notes and tags.

A unique constraint on candidate ID plus normalized keyword prevents accidental duplicates.

### Existing keyword jobs

Keyword Planner jobs and results remain the source history. The result API adds computed classification and scoring fields. Candidate snapshots are independent so deleting or changing a job cannot corrupt saved research.

## Backend Boundaries

The existing three-layer server structure remains intact:

- Router: request validation, authentication dependencies, and response mapping.
- Service: Google Ads orchestration, scoring, classification, candidate lifecycle, and promotion transaction.
- Repository: candidate and keyword persistence queries only.

Candidate endpoints cover list, detail, create, update, delete, keyword mutations, and promotion. Every operation is scoped to the authenticated user. Promotion is transactional: either the affiliate project and link are both committed, or neither is.

## Data Flow

1. The user selects an imported Ads account and submits research inputs.
2. The backend verifies ownership of the account and obtains its delegated refresh token.
3. The backend requests keyword ideas from Google Ads and stores the existing job/result snapshot.
4. Classification and opportunity scores are computed and returned.
5. The browser filters, sorts, and selects results locally.
6. Saving creates a candidate and durable keyword snapshots in one transaction.
7. Promotion validates the URL, creates or reuses the affiliate project, links it to the candidate, and marks the candidate `promoted`.

## Validation and Error Handling

- Research is blocked when no usable delegated Ads account exists, with a direct link to Mail Authorization.
- Invalid or revoked OAuth credentials produce a specific reauthorization message without exposing provider details or tokens.
- Google Ads quota, permission, and unavailable-metrics errors are translated into actionable Vietnamese messages.
- Empty seeds, invalid URLs, invalid location IDs, and oversized result limits are rejected before the provider call.
- Candidate names are required; URLs remain optional until promotion.
- Duplicate candidate keywords are ignored deterministically.
- Promotion of an already-promoted candidate is idempotent.
- Empty states distinguish no account, no search yet, no results, and filters hiding all results.

## Responsive and Accessibility Requirements

- Desktop uses the two-pane layout; tablet and mobile stack the research form above results.
- The result table becomes horizontally scrollable on narrow screens while primary keyword and selection controls remain visible.
- All controls have labels, keyboard focus states, and non-color status text.
- Selection and bulk actions are keyboard operable.
- Loading, error, empty, and disabled states are announced with accessible text.

## Testing

Backend tests cover:

- Account ownership and authorization boundaries.
- Intent classification and opportunity scoring, including missing metrics.
- Candidate CRUD, duplicate keyword handling, status validation, and user isolation.
- Promotion success, idempotency, invalid URL, and transaction rollback.
- Provider error translation.

Frontend tests cover:

- Research form validation and request payloads.
- Filtering, sorting, selection, bulk classification, and score display.
- Candidate creation/editing and promotion flow.
- Loading, error, and empty states.
- Mobile layout behavior where the existing test stack supports it.

Verification includes server tests, client lint/build, migration review, and a browser smoke test against the local application.

## Migration and Compatibility

The change adds new tables and nullable response fields. Existing Keyword Planner jobs, imported Ads accounts, and affiliate projects remain valid. No existing records are rewritten. The current Keyword Planner APIs keep their existing request behavior while response clients gain optional classification fields.

## Success Criteria

- A user can research live Google Ads keyword ideas using an already-delegated account.
- A user can filter and sort results and understand the opportunity score.
- A user can select ideas and save them without providing a URL.
- Saved candidates retain keyword metrics, classification, notes, and source context.
- A candidate can later be promoted into Projects without losing its research history.
- No action mutates Google Ads campaigns or spends account budget.
