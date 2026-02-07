NDCA age-category definitions you’ll need in code
How the couple’s “age category” is determined
For Pre-Teen I, Pre-Teen II, Junior I, Junior II, Youth, Adult: age category is defined by the older partner.
For Senior I–Senior IV: age category is defined by the younger partner.
Age classification timing / grace period
Age classifications (Pre-Teen I through Youth, and Adult) become effective on the actual birthday, but competitors can switch during a 60-day window (30 days before through 30 days after) in the year they move up.
NDCA age ranges / thresholds (the “what ages qualify” part)
Youth: 16th, 17th, or 18th birthday.
Adult: 19th birthday or greater.
Seniors (pair thresholds):
Senior I: one partner ≥35, the other ≥30.
Senior II: one partner ≥45, the other ≥40.
Senior III: one partner ≥55, the other ≥50.
Senior IV: one partner ≥65, the other ≥60.
(Note: in the 2025 compiled NDCA rulebook, Amateur Seniors are listed through Senior IV.)
NDCA “dance up / dance down” eligibility with age ranges
Below, “Declared Category” means the age category the couple is eligible for based on the NDCA definitions above (older partner for Youth/Adult; younger partner for Seniors).
1) Youth-eligible couple (older partner is 16–18)
Allowed entries:
Youth
Adult (NDCA explicitly allows Youth to dance up to Adult)
Not allowed:
Any Senior category (not eligible by age thresholds anyway)
Edge-case exception to implement (if you care):
Youth competitors who turn 19 while still in their final year of High School may continue to dance as Youth until they finish that final year.
2) Adult-eligible couple (older partner is 19+)
Allowed entries:
Adult
Not allowed (by your requested logic + NDCA structure):
Youth (unless they are actually Youth-eligible and choosing to dance up)
Any Senior category unless they meet Senior thresholds
Practical coding note: Adult is not “locked out” of Senior by a special prohibition; it’s simply separate eligibility. If they meet Senior thresholds, they’re Senior-eligible too.
3) Senior I–eligible couple (younger partner defines Seniors; must meet 30/35 rule)
Eligibility threshold recap: one ≥35, the other ≥30
Allowed entries:
Senior I
Adult (NDCA explicitly allows combined Seniors to dance down into Adult; and in general, if you qualify Senior, you qualify Adult because Adult is 19+)
Not allowed:
Senior II / III / IV unless they meet those thresholds
4) Senior II–eligible couple
Threshold: one ≥45, the other ≥40
Allowed entries:
Senior II
Senior I (because meeting Senior II thresholds implies meeting Senior I thresholds)
Adult
Not allowed:
Senior III / IV unless they meet those thresholds
5) Senior III–eligible couple
Threshold: one ≥55, the other ≥50
Allowed entries:
Senior III
Senior II
Senior I
Adult
Not allowed:
Senior IV unless they meet that threshold
6) Senior IV–eligible couple
Threshold: one ≥65, the other ≥60
Allowed entries:
Senior IV
Senior III
Senior II
Senior I
Adult
Machine-friendly rule summary (recommended)
Compute “max eligible age category” from ages
Determine Adult/Youth eligibility from older partner.
Determine Senior level from younger partner against the pair thresholds.
Then allowed entries are:
If Youth-eligible: {Youth, Adult}
If Adult-only: {Adult}
If Senior N eligible: {Adult, Senior 1..N}