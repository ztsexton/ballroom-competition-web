# Architecture Assessment

**Date**: 2026-02-27
**Scope**: Full-stack codebase review (backend + frontend)

---

## Summary

The codebase is well-structured with strong TypeScript coverage, consistent patterns, and good backend test coverage (34 files, 715+ tests). The main areas for improvement are: oversized page components, untyped error catches, missing error logging in catch blocks, a couple of N+1 query patterns, and low frontend test coverage.

---

## Findings

### 1. Oversized Frontend Page Components

Several page files exceed 500 lines, mixing UI rendering, state management, and API orchestration in a single file:

| File | Lines |
|------|-------|
| CompetitionSettingsPage.tsx | 1,177 |
| JudgeScoringPage.tsx | 875 |
| CompetitionEntriesPage.tsx | 850 |
| RunCompetitionPage.tsx | 762 |
| ScrutineerPage.tsx | 725 |
| EventFormPage.tsx | 702 |
| ParticipantPortalPage.tsx | 657 |
| InvoicesPage.tsx | 562 |
| CompetitionsPage.tsx | 544 |
| PublicResultsPage.tsx | 532 |

**Impact**: Harder to read, navigate, and maintain. Increases cognitive load for contributors.

**Recommendation**: Extract logical sections into subcomponents in co-located `components/` folders (already done well for RunCompetitionPage and JudgeScoring).

### 2. Untyped Error Catches (`catch (err: any)`)

24 instances of `catch (err: any)` or `catch (e: any)` across 11 frontend files. TypeScript strict mode should flag these.

**Impact**: Loses type safety, allows unsafe property access on error objects (e.g., `err.response.data.error` without checking).

**Recommendation**: Replace with `catch (err: unknown)` and use type guards or axios `isAxiosError()`.

### 3. Silent/Generic Catch Blocks (Backend)

12 catch blocks in `participant.ts` and `users.ts` swallow error details — they return a generic 500 response without logging the actual error.

```typescript
// Current (bad)
} catch {
  res.status(500).json({ error: 'Failed to load competitions' });
}

// Better
} catch (err) {
  logger.error(err, 'Failed to load competitions');
  res.status(500).json({ error: 'Failed to load competitions' });
}
```

**Impact**: Production debugging is extremely difficult when errors are swallowed.

**Recommendation**: Add `logger.error(err, ...)` to all catch blocks that return 500s.

### 4. N+1 Query Patterns (Backend)

Two confirmed N+1 patterns:

**a) `scrutineer.ts` (lines 56-79)**: Calls `getJudgeScores()` once per bib per dance inside nested loops. For 10 couples and 3 dances, that's 30 separate queries.

**b) `events.ts` (lines 287-296)**: Late-entry logic calls `getScoresForRound()` in a loop over heats.

**Impact**: Slow response times under load, especially for larger competitions.

**Recommendation**: Add batch query methods (`getJudgeScoresForRound`, `getScoresForMultipleRounds`) following the batching pattern already used in `judging.ts`.

### 5. Low Frontend Test Coverage

Only 5 test files for 30+ page components:
- Home.test.tsx
- PublicResultsPage.test.tsx
- ScrutineerPage.test.tsx
- ResultsPage.test.tsx
- EventFormPage.test.tsx

**Impact**: Regressions can go undetected in untested pages.

**Recommendation**: Prioritize tests for high-traffic pages (CompetitionsPage, CompetitionDetailsPage, LoginPage).

### 6. No Route-Level Code Splitting

`App.tsx` imports all 30+ page components eagerly at the top level. No `React.lazy()` usage.

**Impact**: Larger initial bundle size, slower first paint.

**Recommendation**: Lazy-load routes behind authentication and competition-scoped routes.

### 7. .gitignore `results/` Pattern Too Broad

Root `.gitignore` contains `results/` which conflicts with `frontend/src/components/results/`. Files in that directory require `git add -f`.

**Impact**: Friction when adding new result components. Easy to forget `-f` flag.

**Recommendation**: Change to `/results/` (root-only) or a more specific pattern.

---

## Todo List

Ordered by impact and effort:

### Quick Wins (< 30 min each)
- [ ] **T1**: Fix `.gitignore` `results/` pattern to not conflict with `components/results/`
- [ ] **T2**: Add error logging to silent catch blocks in `participant.ts` and `users.ts`
- [ ] **T3**: Replace `catch (err: any)` with `catch (err: unknown)` + type guards across frontend

### Medium Effort (30-60 min each)
- [ ] **T4**: Add `React.lazy()` code splitting for route groups in `App.tsx`
- [ ] **T5**: Fix N+1 in `scrutineer.ts` — batch `getJudgeScores` calls
- [ ] **T6**: Fix N+1 in `events.ts` — batch `getScoresForRound` calls in late-entry logic

### Larger Refactors (60+ min each, skip for now)
- [ ] **T7**: Break up CompetitionSettingsPage.tsx (1,177 lines) into subcomponents
- [ ] **T8**: Break up JudgeScoringPage.tsx (875 lines) into subcomponents
- [ ] **T9**: Break up CompetitionEntriesPage.tsx (850 lines) into subcomponents
- [ ] **T10**: Add frontend tests for CompetitionsPage, CompetitionDetailsPage, LoginPage

*Note: T7-T10 are significant refactors that risk regressions with low frontend test coverage. They should be tackled after T10 (more tests) provides a safety net.*
