R1 — Deterministic advancement set
Given:
a list of entries in a round, and
a computed ordering metric for advancement for that round (e.g., number of recall marks, or an ordered rank list from the scrutineering method),
The system MUST compute the advancement set as follows:
Determine the score/rank of the Nth entry in the sorted results (the “cut-line value”).
Advance all entries whose score/rank is strictly better than the cut-line value.
Also advance all entries whose score/rank equals the cut-line value (the tie group).
Rationale: “Only that number shall dance, except in the case of a tie.” 
2026 January - Compiled Rule Bo…
R2 — No forced tie-breaks / no arbitrary truncation
If a tie exists at the cut line, the system MUST NOT:
break ties using random selection,
truncate the tied group to reach exactly N,
require a “tie-break dance” or re-judging step,
unless the organizer explicitly chooses a different round format outside this rule set.
Final Round Requirements (with max size)
R3 — Final round maximum size hard limit
The system MUST enforce:
FinalRoundSize ≤ 8 
2026 January - Compiled Rule Bo…
This is a hard constraint.
R4 — “Final N” may expand due to tie, up to 8
When producing a final from the prior round using a target final size N_final (commonly 6):
The system MUST apply R1 tie inclusion.
The resulting final size may be N_final, N_final + k, etc. as long as it does not exceed 8.
Example:
N_final = 6
If 3 entries tie at the cut line and only 5 are strictly above it → final size = 8.