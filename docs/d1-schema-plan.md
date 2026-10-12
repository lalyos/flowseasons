# D1 Schema Plan

**Status:** Implemented in [`migrations/0001_initial.sql`](../migrations/0001_initial.sql) and [`migrations/0002_import_upload_receipts.sql`](../migrations/0002_import_upload_receipts.sql).

## Tables

### `events`
One row per Flow Seasons event slot for the year.

- `event_pk` — internal primary key.
- `year` — Flow Seasons year (the POC uses 2026).
- `season` — canonical English season name (`Spring`, `Summer`, `Autumn`, `Winter`).
- `current_import_id` — internal reference to the accepted import currently published for this event.
- Unique slot: `(year, season)`.

### `imports`
One append-only row per **accepted** JSON upload. Rejected uploads remain archived in R2 but do not get an `imports` row. Missing or invalid source identifiers use a fallback R2 key, `raw-results/unidentified-{YYYYMMDDTHHMMSSZ}-{upload-hash}.json`.

- `import_id` — internal primary key.
- `event_pk` — Flow event this upload belongs to.
- `event_id` and `id` — source JSON identifiers, stored as text.
- `r2_key` — `raw-results/{event_id}-{id}-{YYYYMMDDTHHMMSSZ}-{upload-hash}.json`, using source identifiers as text and a stable hash of the incoming key/ETag to avoid collisions.
- `status` — source status (`active` or `finished`).
- `accepted_at` — time the import was accepted/published.

The pair `(event_id, id)` identifies a source result set. Re-importing a known pair updates that Flow event and appends an `imports` row. An unseen pair creates a new Flow event only if its season slot is unused; otherwise reject it.

### `upload_receipts`
One receipt per incoming R2 object version, keyed by `(source_key, source_etag)`. It records the archived `r2_key`, accepted/rejected outcome, rejection reason, and processing time. This makes Queue redelivery idempotent; rejected uploads have a receipt but no `imports` row.

### `event_results`
The current normalized ranking entries for each event. A successful re-import replaces the event's rows; old raw versions remain in R2 and `imports`.

- `entry_id` — internal primary key, so duplicate source entries can be preserved.
- `import_id` — accepted import that supplied the current rows.
- `athlete_id` — source JSON athlete identifier, stored as text.
- `name`, `firstname`, `lastname`, source `rank`, and the exact original `source_category` label. Category matching ignores case, diacritics, and whitespace; the archived source JSON remains unchanged.
- `score_hundredths` — integer score (for example, `1230.85` becomes `123085`); round input scores to two decimal places on import, and store missing or non-numeric scores as zero.

Do not make `athlete_id` unique within an event; preserve every source ranking entry.

### `"athlete-linking"`
Current athlete identity links; edits overwrite the existing link and are not versioned.

- `athlete_id` — source identifier, stored as text and unique.
- `flow_id` — text value such as `flow-16006`; not unique, so multiple source IDs can link to one Flow ID.

The POC seeds one-to-one links (`flow-<athlete_id>`), so different source IDs remain separate until links are deliberately merged.

### `year_categories`
Current year-category assignment for an Athlete.

- `year`.
- `flow_id`.
- `category`.
- Primary key: `(year, flow_id)`; changing the assignment overwrites it.

Each accepted import resolves `athlete_id` through `"athlete-linking"` and upserts the canonical category for athletes present in that import. Later accepted imports and admin edits overwrite the current value.

### `total_standings`
Current Worker-generated Total read model, read by the BFF rather than recalculated per request.

- `year`, `flow_id`, `category`, `score_hundredths`, and `rank`.
- Primary key: `(year, flow_id)`.
- Regenerate after a successfully published source import or a later athlete-link/category change.

## Shared rules

- Store source numeric identifiers (`event_id`, source `id`, `athlete_id`) as text; they are identifiers, not quantities.
- Round each source event score to two decimal places on import, then store it as integer hundredths; missing or non-numeric scores become zero. Total sums these stored values, preserving exact sums and tie comparisons. Serialize decimal scores from the API.
- Uploads arrive under `incoming/`; the Worker keeps the full original JSON in R2 at a unique `raw-results/{event_id}-{id}-{YYYYMMDDTHHMMSSZ}-{upload-hash}.json` key. D1 stores only fields needed for public event and Total results.
- Publish atomically: only switch `events.current_import_id`, replace `event_results`, and publish regenerated `total_standings` after the import and Total generation both succeed.
