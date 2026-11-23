# Additional registration review — 2026-11-23

## Organizer-approved production merges

Applied these five mappings to production and rebuilt Total atomically after organizer confirmation. Source ranking rows were not changed. Each pair has no overlapping ranked events.

| Athlete | Linked VL ID | Retained Flow ID | Current Total | Year category |
|---|---|---|---:|---|
| VADÁSZ Gábor | 23362 | flow-10036 | 320.94 | Hobbi - Férfi |
| DR. MAGYAROS Mátyás | 23824 | flow-17972 | 201.10 | Hobbi - Férfi |
| LÁBISCSÁK Csanád | 13061 | flow-15471 | 643.40 | Nyílt - Férfi |
| REHÁK Gergely | 24017 | flow-9464 | 552.82 | Senior - Férfi |
| REISMAN Balázs | 23798 | flow-18458 | 141.57 | Senior - Férfi |

For athletes with four results, Total uses the best three. Retained the latest current Year category across each pair; REISMAN Balázs therefore uses the Autumn Senior category rather than reverting to Spring Hobbi. Category assignments remain editable in multi-cat.

Backup: `/tmp/flow-prod-before-five-merges-20261123-142902.sql`.

Verified all five mappings, unchanged mappings for every other VL ID, and unchanged saved collision decisions before refreshing the collision projection. Production D1/R2 health checks passed.

## Deferred manual review — do not auto-merge

- **DABI Gabor**: separate Flow IDs `flow-6043` and `flow-23231`. Both have Autumn ranking rows (29.53 and 149.79 points); merging would introduce a same-event collision.
- **Molnár names**: separate Flow IDs `flow-14144`, `flow-18162`, and `flow-15475`. Swapped-name and given-name-subset matches connect common names; overlapping event results make identity ambiguous. Do not treat the connected name-match group as a single athlete.

These remain unmerged. They are documented review candidates, not automatically queued same-event collisions: the current collision detector only evaluates entries already grouped under one Flow ID.

Existing explicit admin split decisions for FARKAS Tamás and HAVASI Gábor were preserved.
