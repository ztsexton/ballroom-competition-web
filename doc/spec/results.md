Ballroom Competition Software
Results Page – Functional Requirements
1. Overview

The Results Page displays competitive outcomes for a ballroom heat, including recall rounds, final rounds, dance-by-dance placements, and overall final results. It must support multi-dance events, multi-judge scoring, and rule-based aggregation of marks.

This page is read-only for most users and represents the authoritative scoring output for a heat.

2. Heat Metadata
2.1 Heat Identification

The system must display:

Heat number (e.g., Heat 14)

Event name (e.g., EUS Open Professional Championship)

Style (e.g., American Smooth)

Division and level (e.g., Professional)

Dances included (e.g., W, T, F, VW)

Heat status (e.g., Semi-Final Round, Final Round)

3. Judges
3.1 Judge Representation

Judges are represented by numeric or alphanumeric identifiers (e.g., 02, 07, 08, etc.).

The judge list must be consistent across all dances within the same round.

4. Couples
4.1 Couple Identification

Each couple must display:

Bib number

Leader name

Follower name

Example:

122 Leonid Burlo & Mariia Usan

5. Recall (Preliminary / Semi-Final) Rounds
5.1 Recall Marks

For each dance in a recall round:

Each judge may assign a recall mark (x) or no mark.

Marks are displayed in a grid:

Rows = couples

Columns = judges

Empty cells represent no recall from that judge.

5.2 Recall Totals

For each couple and dance:

The system must compute a Total Recall Count:

Total = number of judges marking x

Totals must be displayed at the end of each row.

5.3 Multi-Dance Accumulation

For multi-dance events:

The system must compute:

Accumulated Recall Total across all dances

Example: Waltz + Tango + Foxtrot + Viennese Waltz

5.4 Recall Qualification

The system must determine whether a couple is recalled to the next round.

Qualified couples must be visually indicated (e.g., ✓).

Non-recalled couples must not advance.

6. Final Rounds
6.1 Final Round Structure

For each dance in the final:

Judges assign ordinal placements (1–N).

Each judge assigns exactly one placement per couple per dance.

6.2 Placement Display

For each dance:

Display a grid:

Rows = couples

Columns = judges

Cell values = placement numbers

7. Final Placement Calculations
7.1 Majority System

The system must compute results using a majority-based skating system, including:

Count of 1st place marks

Count of placements 1–2, 1–3, 1–4, etc.

Tie-breaking based on:

Higher majority

Lower sum of placements when required

Explicit tie indicators (e.g., 10(39))

7.2 Per-Dance Result

For each dance:

The system must compute a final placement result for each couple.

Results must be displayed as a single rank per couple.

8. Final Overall Results
8.1 Dance-by-Dance Summary

The system must display a summary table containing:

Each dance (e.g., W, T, F, VW)

Final placement per couple for each dance

8.2 Overall Placement

The system must compute the overall final result across all dances.

Overall result must follow championship aggregation rules (e.g., lowest total placement wins).

Example:

W   T   F   VW   Result
1   1   1   1    1

9. Data Integrity Rules

Judges may not assign duplicate placements within the same dance.

Each couple must receive exactly one placement per judge in finals.

Recall totals must match the number of x marks shown.

Accumulated totals must equal the sum of per-dance totals.

10. Display & UX Requirements

Results must be grouped by:

Round → Dance → Couples

The page must clearly separate:

Recall rounds

Final rounds

Overall results

Numeric alignment must be consistent for readability.

The system must support empty rows for couples who did not participate in later rounds.

11. Extensibility Requirements

The Results Page must support:

Variable number of judges

Variable number of dances

Different scoring systems (e.g., single dance, multi-dance, scholarship)

Additional rounds (Quarter-Final, First Round, etc.)

12. Non-Functional Requirements

Results must be reproducible from stored judge marks.

Calculations must be deterministic.

The page must load without recalculating results at render time (precomputed preferred).