# Flow Seasons Results — Product Decisions

## Scope

- The site presents results for one specified Flow Seasons year.
- A Flow Seasons year has four events.
- The current POC focuses on public results pages; admin tools and workflows are deferred.
- Keep the POC minimal: no athlete detail pages or extra features until a working public POC is live.
- Serve the static HTML frontend through Workers Static Assets; the same Worker handles the Backend For Frontend (BFF) API, which reads from D1.
- The public endpoint is `GET /api/results?year=2026`. The initial frontend stage returns/displays event rows only; Total, category filtering, and name search are deferred.
- Store uploaded source JSON in R2 and import it into D1 tables.
- For the POC, upload `results.json` to the R2 `incoming/` prefix with Wrangler. An R2 object-created notification sends it through a Queue to the import Worker; no admin upload UI is needed.
- The D1 `imports` table records accepted uploads only, with source `event_id`, source `id`, and the archived R2 object key. `upload_receipts` records accepted/rejected incoming object versions for Queue idempotency; rejected files remain archived without an `imports` row.
- Keep one `imports` row per accepted upload; re-imports append and do not overwrite import history.
- Use `(event_id, id)` as the source result-set identity: a matching pair updates that result set; an unseen pair creates a new one.
- Reject an unseen source pair if its season already occupies a 2026 event slot; do not create duplicate season tabs or overwrite by season name.
- Use an `athlete-linking` table to map `athlete_id` strings to `flow_id` values. Seed unreviewed IDs one-to-one using `flow-<athlete_id>`; confirmed multi-registration IDs may share a `flow_id`. Each source `athlete_id` has exactly one current link. The reviewed 2026 mappings are recorded in [multi-registration execution notes](multi-registration-execution-notes.md).
- Store source identifiers as strings in D1 even when JSON encodes them as numbers; they are opaque identifiers, not quantities.
- Store event and Total scores as integer hundredths in D1; round each source event score to two decimal places on import before summing Total, and convert scores to decimals for the API and display. Missing or non-numeric source scores become zero; they do not reject an import.
- Normalize only event metadata and ranking entries needed by the public pages; retain the full source JSON, including startlists and routes, in R2.
- Keep only the current normalized ranking rows for each event in D1; a successful re-import replaces them while the accepted import history remains in `imports` and R2.
- Materialize Total standings in D1 with a Worker when source data or admin decisions change; public reads do not recalculate Total.

## Navigation and category view

The minimal first page defers Total, category filtering, and name search; the following are later-stage requirements.

- Results are organized into a **Total** tab and one tab per event.
- **Total** is the default tab when it is implemented. In the initial event-only stage, default to the chronologically latest event with published data.
- Finished and active events are shown. Active events are visibly marked **Aktív** in the Hungarian UI.
- Show event buttons only when multiple events have published data; do not show a placeholder for the fourth event.
- A single page-wide category chooser sits above the result tabs and applies to every tab.
- The chooser includes **Everyone** and categories. **Everyone** is the default and combines participants from all categories.
- Category-specific rankings are a must-have.
- Public result rows show rank, athlete name, category, and score; event rows use the source category and score, while Total uses the year category and summed score.
- Use a table on wider screens and stacked rows/cards on narrow screens, avoiding horizontal scrolling.
- Provide athlete-name search that filters the currently selected tab and category.
- Normalize imported category labels for matching by ignoring case, diacritics, and whitespace; resolve them to the eight canonical Categories. Use canonical labels for display/filtering and preserve the uploaded source JSON unchanged.
- Each athlete has one **year category** for the whole year; accepted imports update it, and an admin may override it. It affects Total standings only.

## Public and admin experiences

- The visitor-facing results experience is a single-page app and must be mobile-friendly.
- Admin tools are separate from the visitor page and may be more elaborate.
- Each person has one stable Flow ID (`flow_id`); multiple original Vertical-Life `athlete_id` values may be associated with it.
- Event tabs preserve the source entries and categories as provided. If the same person has multiple source entries, they remain separate in the event results.
- Athlete linking and year-category assignments are separate admin decisions; they affect Total standings only and do not rewrite source event results.
- Changing an athlete link overwrites its current association; earlier athlete-link decisions are not retained.
- Changing a year-category assignment overwrites the current `(year, flow_id)` value; earlier assignments are not retained.

## Cloudflare tooling

- Use Wrangler CLI; do not install or use the beta `cf` CLI for now.

## Result data updates

- Result files are uploaded manually to R2; the site does not automatically sync from Vertical-Life. Wrangler and a future admin UI use the same `incoming/` upload prefix.
- For the current scope, uploaded result data belongs to Flow Seasons year 2026; selection and behavior for other years are deferred.
- When a future admin upload UI is built, the admin uploads a result file first; the event field is prefilled by mapping the payload's season name to its English equivalent (for example, `Tavasz` → `Spring`).
- An event's status is taken from the `status` field in its latest imported Vertical-Life data; admins do not override it separately.
- Reject an upload if its `status` is missing or unrecognized, leaving the currently published data unchanged.
- Reject an upload if source `event_id` or `id` is missing or invalid; retain the raw file under a unique `raw-results/unidentified-{YYYYMMDDTHHMMSSZ}-{upload-hash}.json` key without an `imports` row.
- Reject an upload if its season name cannot be mapped to one of the four English season names, leaving published data unchanged.
- A valid re-upload replaces the prior source snapshot for that event; it does not append to it.
- Publish a new upload only after its D1 import and Total regeneration both succeed; if either fails, keep the previous snapshot public and retain the raw R2 upload for diagnosis or retry.
- Keep every raw JSON upload in R2 under a unique `raw-results/{event_id}-{id}-{YYYYMMDDTHHMMSSZ}-{upload-hash}.json` key; D1 stores the current imported snapshot.
- Use D1 Time Travel for database restoration; it restores the whole D1 database, not R2 objects, to an earlier point, with a retention window of 7 days on Workers Free or 30 days on Workers Paid. Confirm the deployed database uses D1's production storage backend.
- Uploaded source data remains unchanged in R2. `event_results.source_category` preserves the exact source label; `year_categories.category` stores the canonical label from the latest accepted import. Admin edits affect only `year_categories` and do not rewrite event source results.

## Total standings

- Total is an interim ranking, summing each athlete’s event `score` from finished events to date. Source `athlete_id`s mapped to the same `flow_id` are grouped for Total.
- For IDs without a confirmed athlete-linking mapping, treat each source `athlete_id` as a separate athlete in Total. IDs mapped to the same `flow_id` are grouped.
- Resolve each imported `athlete_id` through `athlete-linking` before updating its year category.
- Total ranks by summed score using Vertical-Life’s competition-ranking rule: ties share a rank and subsequent ranks skip (for example, `1, 1, 3`).
- Total uses each athlete’s current year category; Everyone combines all categories. Last successful write wins: imports update athletes present in the file, while admin edits can override the current value.
- A missing result in a finished event contributes zero; an athlete with at least one finished-event result remains in Total.
- An active event’s provisional score is shown in that event’s tab but is not included in Total until the event is finished.
- The Total ranking becomes final after all four events are finished.
