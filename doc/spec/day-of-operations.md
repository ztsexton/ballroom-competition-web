# Day-of Operations: Scratches, Late Entry, Heat Re-splitting

This document covers live day-of competition operations that modify entries, scoring, and heat assignments after a competition has started.

## 1. Scratch / Withdraw

### Semantics

- **Scope**: Event-scoped. A couple can be scratched from one event and remain active in others.
- **Timing**: Can be applied at any time, including mid-scoring.
- **Reversible**: A scratched couple can be unscratched (reinstated) at any time.
- **Storage**: `scratchedBibs: number[]` on the `Event` object. Scratched bibs stay in `heat.bibs` arrays to preserve history and enable unscratch.
- **No new tables**: Uses `updateEvent(id, { scratchedBibs })`.

### Filtering

Scratched bibs are excluded at every scoring/results/display point:

- **`calculateResults`**: Scratched bibs filtered out before score lookup.
- **`getTopCouples` (advancement)**: Scratched bibs never advance.
- **`compileJudgeScores`**: Scratched bibs not included in compiled scores.
- **`submitJudgeScores`**: `allSubmitted` check ignores scratched bibs — judges don't need to score them.
- **`scoreEvent`**: Scratched bibs excluded from the score map.
- **Judge active-heat screen**: Scratched bibs not shown to judges.
- **Scoring progress**: Scratched bibs not counted in submission tracking.
- **Public heat lists**: Scratched bibs not shown.
- **Public couple count**: Excludes scratched bibs.

### API

```
POST /api/events/:id/scratch          { bib }        -> 200 (updated event)
DELETE /api/events/:id/scratch/:bib                   -> 200 (updated event)
```

### Edge Cases

- **Scratch after partial scoring**: If a couple was already scored in a recall round, their existing scores remain in the database but are excluded from results/advancement calculations. Their marks effectively "don't count."
- **Scratch in final round**: The couple disappears from final results.
- **Unscratch after advancement**: If a couple is unscratched after bibs were advanced to the next round, they are NOT automatically added to the next round. The organizer must handle this manually (e.g., via late entry to the next round).
- **Double scratch**: Returns 409 if the bib is already scratched.
- **Bib not in event**: Returns 404.

---

## 2. Late Entry

### Semantics

- **Purpose**: Add a couple to an event that already has scores (bypasses the normal `hasAnyScores` guard).
- **First round**: Bib is always added to the first round's `bibs` array.
- **Future rounds**: Bib is added to subsequent rounds only if:
  1. The round has populated bibs (advancement has happened), AND
  2. The round has no scores yet.
- **Already-scored rounds**: Never modified retroactively.
- **Schedule integration**: If the event has floor heats in the schedule, the bib is added to the smallest pending floor heat's `bibSubset`.

### API

```
POST /api/events/:id/late-entry       { bib }        -> 200 (updated event)
```

### Edge Cases

- **Already in event**: Returns 409.
- **Couple not in competition**: Returns 404.
- **Late entry to scored final**: Bib is added to the first round but NOT to the final (since it has scores). The organizer would need to handle this manually.
- **Late entry + floor heats**: The bib is automatically added to the smallest pending floor heat to keep floor heat sizes balanced.

---

## 3. Mid-Competition Heat Re-splitting

### Semantics

- **Purpose**: Split remaining pending heats of a partially-scored event into floor heats. Useful when the first dance of a multi-dance event ran as a single heat but subsequent dances need to be split.
- **Only pending heats**: Completed and in-progress (scoring) heats are never touched.
- **Existing split heats**: All pending heats for the target event/round are removed and replaced with new floor heats.

### API

```
POST /api/schedules/:competitionId/heat/resplit
  { eventId, round, groupCount }       -> 200 (updated schedule)
```

### Edge Cases

- **No pending heats**: Returns 400 (nothing to split).
- **Invalid groupCount**: Must be >= 2 and <= number of bibs. Returns 400 otherwise.
- **Multi-dance events**: Creates `danceCount x groupCount` floor heats (one per dance per group).
- **`currentHeatIndex` adjustment**: Correctly adjusted when heats are removed/inserted before the current position.

---

## 4. Floor Heat Bib Reassignment

### Semantics

- **Purpose**: Move specific bibs between pending floor heats. Useful when an organizer wants to rebalance floor heats or group specific couples together.
- **Pending only**: Can only modify pending heats. Scoring or completed heats return 409.
- **Floor heat only**: Heat must have a `bibSubset` (be a floor heat). Non-floor-heats return 400.
- **Validation**: All bibs must be present in the event's round bibs. Invalid bibs return 400.

### API

```
PATCH /api/schedules/:competitionId/heat/:heatId/bibs
  { bibSubset }                        -> 200 (updated schedule)
```

### Edge Cases

- **Moving all bibs out**: The endpoint doesn't prevent setting a floor heat to have all bibs while another has none. The organizer is responsible for keeping heats balanced.
- **Bibs not in event**: Returns 400 with the invalid bib numbers listed.
- **Non-pending heat**: Returns 409.

---

## Data Model

### Event (extended)

```typescript
interface Event {
  // ... existing fields ...
  scratchedBibs?: number[];  // Bibs withdrawn from this event
}
```

The `scratchedBibs` array is stored alongside the event. It's a simple list — no timestamps or metadata. Scratched bibs remain in `heat.bibs` arrays.

### Database Migration

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS scratched_bibs JSONB DEFAULT '[]';
```

This migration runs automatically on server startup (idempotent).
