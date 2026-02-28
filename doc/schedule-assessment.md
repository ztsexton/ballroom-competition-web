# Schedule & Heat Management Assessment

## Current State

### What Works

**Schedule Generation** (`scheduleGenerator.ts`)
- Generates a full schedule from events, ordered by style → level priority
- Auto-merges compatible heats during generation (same scoring type, same style, within couple limit)
- Multi-dance events handled via dance-per-heat entries
- Floor heat splitting for large rounds (split into N groups)

**Manual Merge/Split** (`scheduleModification.ts`)
- `updateHeatEntries()` — merge heats by combining entries into one heat
- `splitHeatEntry()` — split a multi-entry heat back into separate heats
- `splitRoundIntoFloorHeats()` / `unsplitFloorHeats()` — split large rounds into floor groups
- `resplitPendingHeats()` — re-split pending heats with different group count

**Back-to-Back Detection** (`backToBack.ts`)
- Detects couples scheduled in consecutive heats
- `minimizeBackToBack()` — reorders heats to reduce consecutive conflicts

**Schedule Navigation** (`heatNavigation.ts`, `heatStatus.ts`)
- Advance/back/jump heat state machine
- Heat status tracking (pending → scoring → completed)
- Reset-to-heat and rerun-heat capabilities

**Timing** (`timingService.ts`)
- Estimated start times calculated from configurable dance durations
- Level-specific duration overrides
- Break duration support
- Recalculation on schedule changes

**UI** (`SchedulePage.tsx`, `ScheduleHeatTable.tsx`)
- Drag-and-drop reordering
- Merge mode with source/target selection
- Break insertion/removal
- Expand/collapse multi-entry heats
- Timing display (estimated start/finish)

### Gaps & Limitations

**Incomplete Merge Pre-Filtering**
- `getMergeIncompatibilityReason()` only checks `scoringType` and `style`
- Users can select heats that will fail backend validation for:
  - Couple count overflow (exceeds `maxCouplesPerHeat`)
  - Round mismatch (different rounds cannot be merged)
  - Multi-round events (events with >1 heat cannot be merged)
  - Already completed/scoring heats
  - Overlapping bibs (same couples in both heats)
- Backend returns `null` (silent failure), user sees generic error message

**No Duration/Time Window Configuration**
- No concept of competition days or start/end times
- Cannot specify "competition runs from 9am-5pm over 2 days"
- No comparison of estimated duration vs available time
- No warning when schedule exceeds available time

**No Schedule Compression/Optimization**
- No automated suggestions for reducing schedule duration
- No way to auto-merge compatible adjacent heats
- No recommendation for adjusting `maxCouplesPerHeat`
- Organizers must manually find and merge compatible heats

**Backend Merge Validation Gap**
- `updateHeatEntries()` validates scoring type and couple count
- Does NOT validate style compatibility (frontend checks but backend doesn't enforce)
- No round-mismatch validation at backend level

## Improvements Being Made

1. **Enhanced merge pre-filtering** — `getMergeIncompatibilityReason()` extended with all validation checks (heat status, round mismatch, multi-round events, couple count overflow, overlapping bibs)
2. **Backend style validation** — Added to `updateHeatEntries()` for defense-in-depth
3. **Schedule duration configuration** — `ScheduleDayConfig` type with per-day start/end times
4. **Schedule optimizer** — Automated analysis of schedule duration vs available time, with merge suggestions and max-couples-per-heat increase recommendations
5. **Tests** — Frontend utils tests, backend merge validation tests, optimizer tests, route tests
