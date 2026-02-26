# Test Coverage Assessment

**Date:** 2026-02-25 (updated)
**Scope:** Full project assessment against implemented requirements

---

## 1. Requirements Sources

This assessment evaluates test coverage against the following requirement documents and implemented features:

| Source | Description |
|--------|------------|
| `doc/spec/results.md` | Results Page functional requirements (12 sections) |
| `doc/planning/ideas.md` | Age categories, levels, back-to-back rules |
| `doc/spec/scoring.md` | Advancement rules R1–R4 (tie handling, final max size) |
| `CLAUDE.md` | Architecture, API design, coding standards |

---

## 2. Current Test Inventory

| Layer | Files | Test Cases | Status |
|-------|-------|------------|--------|
| Backend unit/integration | 33 | 715 | Active |
| Frontend unit (Vitest) | 5 | 22 | Active |
| E2E active (Cypress) | 2 | 4 | Active |
| E2E legacy (Cypress) | 10 | ~400 | Abandoned/not running |

---

## 3. Backend Route-Level Coverage

### 3.1 Tested Routes (15 of 16 files)

| Route File | Endpoints | Test File | Notes |
|-----------|-----------|-----------|-------|
| `competitions.ts` | 8 | `competitions.test.ts` | CRUD, level mode, publicity, admin CRUD |
| `events.ts` | 12 | `events.test.ts` | CRUD, scores, results, structural change warnings |
| `schedules.ts` | 21 | `schedules.test.ts` | Generation, multi-entry heats, splitting |
| `organizations.ts` | 5 | `organizations.test.ts` | CRUD, rule presets (NDCA/USA Dance/custom) |
| `public.ts` | 6 | `public.test.ts` | Visibility filtering, results access control |
| `people.ts` | 5 | `people.test.ts` | CRUD, competition-scoped access |
| `couples.ts` | 6 | `couples.test.ts` | CRUD, eligibility |
| `judges.ts` | 5 | `judges.test.ts` | CRUD |
| `scrutineer.ts` | 3 | `scrutineer.test.ts` | Paper judging entry, score compilation |
| `invoices.ts` | 4 | `invoices.test.ts` | Billing, PDF generation |
| `users.ts` | 5 | `users.test.ts` | Auth, admin toggling, admin-competitions |
| `studios.ts` | 5 | `studios.test.ts` | CRUD |
| `participant.ts` | 10 | `participant.test.ts` | Self-service registration, entry management |
| `judging.ts` | 8 | `judging.test.ts` | Live judge scoring, active heat, progress |
| `database.ts` | 3 | `database.test.ts` | Health check, migration |

### 3.2 Untested Routes (1 of 16 files)

| Route File | Endpoints | Risk | Priority |
|-----------|-----------|------|----------|
| `mindbody.ts` | 4 | **Low** — external integration | P3 |

---

## 4. Backend Service-Level Coverage

### 4.1 Tested Services (20 of 24 files)

| Service | Test File | Tests | Coverage Quality |
|---------|----------|-------|-----------------|
| `advancement` (computeAdvancementBibs) | `advancement.test.ts` | 22 | **Excellent** — R1–R4 rules, ties, edge cases |
| `scoringService.ts` | `scoringService.test.ts` | ✓ | **Good** — recall compilation, final ranking, multi-dance |
| `skatingSystem.ts` | `skatingSystem.test.ts` | ✓ | **Good** — majority rule, tie-breaking |
| `backToBack` | `backToBack.test.ts` | 4 | **Adequate** — detection + minimization |
| `concurrency` | `concurrency.test.ts` | 7 | **Good** — simultaneous judges, concurrent reads |
| `validationService` | `validationService.test.ts` | 25 | **Excellent** — NDCA age rules, level validation |
| `registrationService` | `registrationService.test.ts` | ✓ | **Good** — couple registration, find-or-create |
| `invoiceService` | `invoiceService.test.ts` | ✓ | **Good** — invoice calculation, fee computation |
| `timingService` | `timingService.test.ts` | ✓ | **Good** — heat timing calculations |
| `heatNavigation` | `heatNavigation.test.ts` | ✓ | **Good** — advance/back/dance state machine |
| `heatStatus` | `heatStatus.test.ts` | ✓ | **Good** — heat status tracking |
| `scheduleModification` | `scheduleModification.test.ts` | ✓ | **Good** — reorder/insert/break operations |
| `scheduleHelpers` | `scheduleHelpers.test.ts` | ✓ | **Good** — schedule utility functions |
| `cachingDataService` | `cachingDataService.test.ts` | ✓ | **Good** — caching wrapper behavior |
| `JsonDataService` | `data/jsonDataService.test.ts` | ~60 | **Excellent** — full contract |
| `PostgresDataService` | `data/postgresDataService.test.ts` | ~60 | **Excellent** — full contract |
| `rounds` (constants) | `constants/rounds.test.ts` | ✓ | **Good** — round generation rules |
| Performance tests | `performance.test.ts` | ✓ | **Good** — load testing |

### 4.2 Untested Services (4 of 24 files)

| Service | Risk | Priority | Notes |
|---------|------|----------|-------|
| `pdfService.ts` | Medium | P2 | PDF generation — difficult to unit test |
| `emailService.ts` | Low | P3 | Email delivery — external dependency |
| `sseService.ts` | Low | P3 | Server-sent events — integration concern |
| `mindbodyService.ts` | Low | P3 | External API client |

---

## 5. Frontend Coverage

### 5.1 Current State: 5 of ~46 page components tested (11%)

**Tested:**
- `Home.tsx` — 3 tests (welcome message, empty state, new competition button)
- `EventFormPage.tsx` — 4 tests (level mode toggle, combined vs integrated)
- `ResultsPage.tsx` — 8 tests (loading, errors, recall marks, final placements, multi-dance, proficiency, round selector)
- `ScrutineerPage.tsx` — 3 tests (access denied, event browser, no competition)
- `PublicResultsPage.tsx` — 4 tests (competition list, empty state, event list, loading)

### 5.2 Untested Pages by Priority

#### P0 — Mission-Critical (live competition & core output)

| Page | Risk | Reason |
|------|------|--------|
| **`JudgeScoringPage.tsx`** | **Critical** | Real-time judge scoring during live competitions |
| **`RunCompetitionPage.tsx`** | **Critical** | Day-of competition runner — heat advancement |

#### P1 — Core Workflows

| Page | Risk | Reason |
|------|------|--------|
| `CompetitionSettingsPage.tsx` | High | Complex settings form, competition admin management |
| `SchedulePage.tsx` | High | Schedule generation, heat management |
| `PeoplePage.tsx` | High | Participant management CRUD |
| `CouplesPage.tsx` | High | Couple pairing, bib assignment |
| `JudgesPage.tsx` | High | Judge management, chairman assignment |
| `EventsPage.tsx` | High | Event listing, filtering |
| `EventEntriesPage.tsx` | High | Entry management per event |
| `ParticipantPortalPage.tsx` | High | Self-service registration flow |

#### P2 — Supporting Pages

| Page | Risk | Reason |
|------|------|--------|
| `CompetitionsPage.tsx` | Medium | Competition list and creation |
| `CompetitionDetailsPage.tsx` | Medium | Competition summary view |
| `AdminDashboardPage.tsx` | Medium | Admin hub page |
| `InvoicesPage.tsx` | Medium | Billing management |
| `LoginPage.tsx` | Medium | Auth flow |
| `ProfilePage.tsx` | Medium | User profile management |
| `PublicHomePage.tsx` | Medium | Public landing page |
| `PublicHeatListsPage.tsx` | Medium | Public heat sheet display |

#### P3 — Lower Risk

| Page | Risk | Reason |
|------|------|--------|
| `OnDeckPage.tsx` | Low | Display-only |
| `LiveCompetitionPage.tsx` | Low | Display-only |
| `FaqPage.tsx` | Low | Static content |
| `PricingPage.tsx` | Low | Static content |
| `OrganizationsPage.tsx` | Low | Admin-only |
| `UsersPage.tsx` | Low | Admin-only |
| `StudioPage.tsx` | Low | Admin-only |

---

## 6. Coverage Against `doc/spec/results.md` Requirements

### 6.1 Heat Metadata (Section 2)

| Requirement | Backend | Frontend | Verdict |
|------------|---------|----------|---------|
| Display heat number | Stored in data | **Not tested** | **GAP** |
| Display event name, style, division | Events route tested | `ResultsPage.test.tsx` checks event name | **Partial** |
| Display dances included | Events route returns this | **Not tested** | **GAP** |
| Display heat status (Semi-Final, Final) | Events route returns this | `ResultsPage.test.tsx` tests round selector | **Covered** |

### 6.2 Recall Rounds (Section 5)

| Requirement | Backend | Frontend | Verdict |
|------------|---------|----------|---------|
| Recall marks grid (couples x judges) | `scoringService.test.ts` | `ResultsPage.test.tsx` tests recall grid | **Covered** |
| Recall totals per couple per dance | `scoringService.test.ts` | **Not tested** | **Partial** |
| Multi-dance recall accumulation | `scoringService.test.ts` | **Not tested** | **Partial** |
| Recall qualification indicator | `scoringService.test.ts` | `ResultsPage.test.tsx` checks isRecall | **Covered** |

### 6.3 Final Rounds (Section 6–7)

| Requirement | Backend | Frontend | Verdict |
|------------|---------|----------|---------|
| Ordinal placements grid | `scoringService.test.ts` | `ResultsPage.test.tsx` tests placement grid | **Covered** |
| Majority/skating system (count of 1st, 1–2, 1–3...) | `skatingSystem.test.ts` | `ResultsPage.test.tsx` tests skating breakdown | **Covered** |
| Tie-breaking (higher majority, lower sum) | `advancement.test.ts` + `skatingSystem.test.ts` | **Not tested** | **Partial** |
| Per-dance final result | `scoringService.test.ts` | **Not tested** | **Partial** |

### 6.4 Overall Results (Section 8)

| Requirement | Backend | Frontend | Verdict |
|------------|---------|----------|---------|
| Dance-by-dance summary table | `scoringService.test.ts` | `ResultsPage.test.tsx` tests multi-dance summary | **Covered** |
| Overall placement across all dances | `scoringService.test.ts` | `ResultsPage.test.tsx` checks overall placement | **Covered** |

### 6.5 Data Integrity (Section 9)

| Requirement | Backend | Frontend | Verdict |
|------------|---------|----------|---------|
| No duplicate placements per judge per dance | **Not tested** | **Not tested** | **GAP** |
| Each couple gets exactly one placement per judge | **Not tested** | **Not tested** | **GAP** |
| Recall totals match mark count | **Not tested** | **Not tested** | **GAP** |
| Accumulated totals = sum of per-dance totals | **Not tested** | **Not tested** | **GAP** |

### 6.6 Display & UX (Section 10)

| Requirement | Backend | Frontend | Verdict |
|------------|---------|----------|---------|
| Grouped by Round > Dance > Couples | N/A | **Not tested** | **GAP** |
| Clear separation of recall/final/overall | N/A | `ResultsPage.test.tsx` tests both round types | **Partial** |
| Numeric alignment | N/A | **Not tested** | **GAP** |
| Empty rows for non-participating couples | N/A | **Not tested** | **GAP** |

### 6.7 Extensibility (Section 11) & Non-Functional (Section 12)

| Requirement | Backend | Frontend | Verdict |
|------------|---------|----------|---------|
| Variable judges/dances | Events route tested | **Not tested** | **Partial** |
| Different scoring systems | Events route tested | `ResultsPage.test.tsx` tests proficiency | **Covered** |
| Deterministic calculations | `skatingSystem.test.ts` | **Not tested** | **Partial** |
| Precomputed results (no render-time recalculation) | **Not tested** | **Not tested** | **GAP** |

---

## 7. Coverage Against `scoring.md` Rules

| Rule | Test Coverage | Verdict |
|------|-------------|---------|
| **R1** — Include tie group at cut line | `advancement.test.ts` (8 tests) | **Covered** |
| **R2** — No forced tie-breaks | `advancement.test.ts` (1 test) | **Covered** |
| **R3** — Final ≤ 8 hard limit | `advancement.test.ts` (3 tests) | **Covered** |
| **R4** — Final expands with ties up to 8 | `advancement.test.ts` (2 tests) | **Covered** |
| Skating method calculation | `skatingSystem.test.ts` | **Covered** |
| Multi-dance result aggregation | `scoringService.test.ts` | **Covered** |

---

## 8. Coverage Against Implemented Features

| Implemented Feature | Backend Tests | Frontend Tests | Overall |
|--------------------|--------------|---------------|---------|
| People CRUD | Route + data contract | None | **Moderate** |
| Couples CRUD | Route + data contract | None | **Moderate** |
| Judges CRUD | Route + data contract | None | **Moderate** |
| Events CRUD | Route + data contract | EventFormPage (4 tests) | **Good** |
| Round-by-round scoring | Route + service tests | None | **Good** |
| Skating system calculations | `skatingSystem.test.ts` | None | **Good** |
| Scoring service | `scoringService.test.ts` | None | **Good** |
| Results display | Route tests | ResultsPage (8 tests) | **Good** |
| Public results | Route tests | PublicResultsPage (4 tests) | **Good** |
| Automatic bib/judge numbering | Data contract | None | **Moderate** |
| Round generation from count | Data contract + route + constants | None | **Good** |
| Organizations + rule presets | Route tests | None | **Moderate** |
| Scheduling/heats | Route + service tests | None | **Good** |
| Heat navigation | `heatNavigation.test.ts` | None | **Good** |
| Back-to-back detection | `backToBack.test.ts` | None | **Good** |
| Registration service | `registrationService.test.ts` | None | **Good** |
| Invoice generation | Route + service tests | None | **Good** |
| Judge scoring API | Route tests | None | **Moderate** |
| Scrutineer API | Route tests | ScrutineerPage (3 tests) | **Good** |
| Participant portal API | Route tests | None | **Moderate** |
| User auth + profile | Route tests | Home (3 tests) | **Moderate** |
| Competition admin roles | Route tests (users) | None | **Moderate** |
| NDCA age validation | `validationService.test.ts` (25) | None | **Excellent** |
| Advancement rules R1-R4 | `advancement.test.ts` (22) | None | **Excellent** |
| Data service contracts | JSON (60) + Postgres (60) | None | **Excellent** |
| Caching layer | `cachingDataService.test.ts` | None | **Good** |
| Performance | `performance.test.ts` | None | **Good** |

---

## 9. Legacy E2E Tests Assessment

The `e2e-tests/cypress/e2e/_legacy/` directory contains 10 comprehensive test suites (~400 test cases) covering:

- Competition settings (40+ tests)
- Competition management (20+ tests)
- Participant management (25+ tests)
- Event management (30+ tests)
- Scheduling (35+ tests)
- Scoring & results (30+ tests)
- Invoicing (30+ tests)
- Public pages (35+ tests)
- Error handling (40+ tests)
- Authentication (15+ tests)

**These tests appear to be non-functional.** If revived, they would close the majority of frontend and integration coverage gaps.

---

## 10. Risk Summary

### CRITICAL (data correctness at stake)

| # | Gap | Impact |
|---|-----|--------|
| 1 | Data integrity rules untested | Duplicate placements or mismatched totals go undetected |
| 2 | JudgeScoringPage untested | Judge scoring UI could crash during live competition |
| 3 | RunCompetitionPage untested | Competition runner UI could crash during live competition |

### HIGH (live competition disruption)

| # | Gap | Impact |
|---|-----|--------|
| 4 | Day-of frontend pages untested | Competition runner/judge UI could have regressions |
| 5 | Schedule page untested | Schedule management UI could break |
| 6 | Competition settings untested | Admin management UI could fail |

### MEDIUM (operational issues)

| # | Gap | Impact |
|---|-----|--------|
| 7 | 41 of 46 frontend pages untested | UI regressions undetected |
| 8 | Competition admin role frontend untested | Admin dashboard could fail |
| 9 | PDF service untested | Invoice PDFs could be malformed |

---

## 11. Recommended Next Steps (Prioritized)

### Phase 1 — Day-of Frontend (P0)

**Goal:** Ensure live competition pages don't crash.

1. **`JudgeScoringPage.test.tsx`** — Judge scoring form rendering
2. **`RunCompetitionPage.test.tsx`** — Heat advancement UI

### Phase 2 — Core Workflow Frontend (P1)

**Goal:** Prevent regressions in setup workflows.

3. **`CompetitionSettingsPage.test.tsx`** — Settings form + competition admin management
4. **`SchedulePage.test.tsx`** — Schedule generation UI
5. **`PeoplePage.test.tsx`** — People CRUD
6. **`CouplesPage.test.tsx`** — Couple management
7. **`AdminDashboardPage.test.tsx`** — Admin hub

### Phase 3 — Data Integrity (P1)

**Goal:** Prevent invalid scoring data.

8. Add data integrity tests to `scoringService.test.ts`:
   - No duplicate placements per judge per dance
   - Each couple gets exactly one placement per judge
   - Recall totals match mark count

### Phase 4 — E2E Revival (P2)

**Goal:** Restore integration confidence across the full stack.

9. Audit legacy Cypress tests — determine what's broken and why
10. Update or rewrite tests against current UI selectors/flows
11. Wire E2E tests into CI pipeline

---

## 12. Coverage Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Backend route files tested | 15/16 (94%) | 16/16 (100%) |
| Backend services tested | 20/24 (83%) | 22/24 (92%) |
| Frontend pages tested | 5/46 (11%) | 15/46 (33%) |
| `doc/spec/results.md` requirements covered | ~60% | 80% |
| `doc/spec/scoring.md` rules covered | 100% | 100% ✓ |
| Active E2E scenarios | 4 | 50+ |
