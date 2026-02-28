# Seed Finished Competition

## Overview

Add a "Create Finished Test Competition" button alongside the existing "Create Test Competition" button in the Developer Tools section. This creates a fully-completed competition with all events scored through all rounds, a completed schedule, and final results — enabling validation of results pages, scoring displays, heat lists, and public views without manually running a competition.

## Requirements

### Functional

1. **New API endpoint**: `POST /api/database/seed-finished` (admin-only, same auth as existing seed)
2. **New frontend button**: In the Developer Tools section of the Home page, next to the existing seed button
3. **Idempotent**: Re-running deletes and recreates the finished competition (identified by name)
4. **Works with both data backends**: Uses `dataService` abstraction (not raw SQL), so it works with both PostgreSQL and JSON file storage

### Competition Data Created

| Entity | Count | Details |
|--------|-------|---------|
| Competition | 1 | "Stardust Invitational 2026 [FINISHED]", type=NDCA |
| People | 80 | 40 leaders + 40 followers |
| Couples | 40 | Bibs 201-240 |
| Judges | 5 | Judge numbers 1-5 |
| Events | 12 | Diverse mix covering all scoring edge cases |
| Schedule | 1 | Fully generated, all heats marked completed |

### Events & Edge Cases Covered

| # | Event Name | Couples | Rounds | Type | Edge Case Tested |
|---|-----------|---------|--------|------|-----------------|
| 1 | Smooth Bronze Waltz | 5 | Final | Standard single-dance | Basic skating placement |
| 2 | Smooth Silver Tango | 10 | Semi + Final | Standard single-dance | Recall advancement + final skating |
| 3 | Smooth Gold Foxtrot | 18 | QF + Semi + Final | Standard single-dance | Three-round progression |
| 4 | Smooth Open Championship | 5 | Final | Multi-dance (W/T/F) | Rules 9-11, multi-dance aggregation |
| 5 | Rhythm Bronze Cha Cha | 6 | Final | Standard single-dance | Full final (max capacity) |
| 6 | Rhythm Silver Rumba | 8 | Semi + Final | Standard single-dance | Tight recall cut (8→6) |
| 7 | Rhythm Gold Mambo | 5 | Final | Standard single-dance | Judges disagree (split decisions) |
| 8 | Rhythm Open Championship | 8 | Semi + Final | Multi-dance (CC/R/J) | Multi-dance recall + final |
| 9 | Latin Bronze Samba | 6 | Final | Proficiency | Proficiency scoring (averages) |
| 10 | Latin Silver Paso Doble | 5 | Final | Standard + scratch | Scratched couple handling |
| 11 | Latin Gold Jive | 6 | Final | Standard single-dance | Deliberate skating tie (Rules 6-7) |
| 12 | Smooth Scholarship | 5 | Final | Multi-dance scholarship | Scholarship event flag + multi-dance |

### Scoring Patterns

**Recall rounds**: Each judge marks their top N couples. Judges mostly agree but with 1-2 disagreements per round to create realistic variation.

**Final rounds (standard)**: Each judge ranks all couples 1..N. Rankings are generated from a "base skill order" with per-judge permutations:
- Judge 0: Exact base order (1, 2, 3, 4, 5)
- Judge 1: Adjacent swap (2, 1, 4, 3, 5)
- Judge 2: Middle shuffle (1, 3, 2, 5, 4)
- Judge 3: Reversed middle (1, 4, 3, 2, 5)
- Judge 4: Minor variation (2, 1, 3, 4, 5)

This creates realistic patterns where the skating system must resolve disagreements.

**Proficiency**: Scores on a 1-10 scale, mapped from skill rank. Top couple gets ~9.5, bottom gets ~7.0, with per-judge noise.

**Tie scenario (Event 11)**: Two couples receive identical rank distributions, forcing Rule 6/7 tie-breaking in the skating system.

**Scratch scenario (Event 10)**: One couple is scratched before final scoring. Results should show 4 placed couples, not 5.

### Schedule

- Generated using the standard `scheduleService.generateSchedule()`
- All heat statuses set to `'completed'`
- `currentHeatIndex` set past the last heat
- Estimated start times populated from generation

## Technical Approach

### Backend

1. **New file**: `backend/src/services/seedFinishedCompetition.ts`
   - Exports `seedFinishedCompetition(dataService, scoringService, scheduleService)`
   - Creates all entities via dataService
   - Scores events via `scoringService.scoreEvent()` (single-dance) or `dataService.setScores()` (multi-dance/proficiency)
   - Generates and completes schedule

2. **Modified file**: `backend/src/routes/database.ts`
   - New endpoint: `POST /api/database/seed-finished`
   - Admin-only auth (same as existing seed)

### Frontend

1. **Modified file**: `frontend/src/api/client.ts`
   - Add `seedFinished()` method to `databaseApi`

2. **Modified file**: `frontend/src/pages/Home.tsx`
   - Add second card in Developer Tools for the finished competition seed
   - Independent loading/error state from existing seed button

### Scoring Flow Per Event

For **single-dance standard events** (recall + final):
1. Create event with bibs and judges → auto-generates heat structure
2. For each recall round: call `scoringService.scoreEvent()` with recall marks → auto-advances
3. For the final round: call `scoringService.scoreEvent()` with rankings

For **multi-dance events**:
1. Create event with bibs, judges, and dances array
2. For each recall round, for each dance: call `dataService.setScores()` with marks per dance
3. Calculate results and advance manually via `dataService.advanceToNextRound()`
4. For the final round, for each dance: call `dataService.setScores()` with ranks per dance

For **proficiency events**:
1. Create event with `scoringType: 'proficiency'`
2. Call `dataService.setScores()` with judge scores (1-10 scale)

### Cleanup

On re-seed, the function:
1. Finds any competition named "Stardust Invitational 2026 [FINISHED]"
2. Deletes it (cascade deletes people, couples, judges, events, scores, schedule)
3. Creates everything fresh

## Verification

- `cd backend && npx tsc --noEmit` — TypeScript clean
- `cd backend && npm test` — All tests pass
- `cd frontend && npx tsc --noEmit` — TypeScript clean
- `cd frontend && npm test` — All tests pass
- Manual: Click button, verify competition appears, navigate to events/results/schedule pages
