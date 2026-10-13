# Flow Seasons Results — POC Plan

**Status:** The R2 importer has published Spring, Summer, and Autumn. The deployed BFF returns materialized Total plus event results; the Hungarian frontend defaults to Total and has a page-wide category filter. Athlete-name search remains deferred.

## Goal and scope

Build a live, mobile-friendly public results page for **Flow Seasons year 2026**. The POC shows the Total standings and the events with published data. The supplied files cover Spring and Summer (finished) and Autumn (active); do not show a placeholder tab for the fourth event.

Keep the POC focused: no admin UI, public upload endpoint, athlete detail pages, or multi-year selection. Uploads are performed manually with Wrangler to R2; object-created notifications enqueue imports for the Worker. Admin functionality and other years are deferred.

## Architecture

```text
Browser
  └─ static HTML/CSS/JS (Workers Static Assets)
       └─ GET /api/results?year=2026 (same Worker, BFF)
            └─ D1 current event results + materialized Total

Wrangler or future admin upload
  └─ R2 incoming/ prefix
       └─ R2 notification → Queue → import Worker
            ├─ archive raw JSON in R2
            └─ atomically publish D1 snapshot and Total
```

- Use **Workers Static Assets** to serve the static frontend and the same Worker for the BFF. Deploy them together with Wrangler.
- Static assets may be served directly; route `/api/*` through Worker logic (`run_worker_first`) so the API never falls through to an SPA HTML response.
- The BFF reads D1 only. It does not parse source JSON from R2 on public requests or recalculate Total per request.
- Return `Cache-Control: no-store` from the results API so the next page load sees the latest published snapshot.
- Use Wrangler, not the beta `cf` CLI.

## Public frontend

- One static results page with **Total** as the default tab, then one tab per event with published data. Mark active events **Aktív**.
- A page-wide category chooser includes **Everyone** by default and applies to the selected tab. Selected-category positions are recalculated from 1, preserving competition ties; Everyone retains overall ranks. Athlete-name search filters the selected tab and category.
- Rows show rank, athlete name, category, and score. Event rows use source categories/scores; Total rows use year categories/summed scores.
- Preserve separate source ranking entries in event tabs. Match category labels ignoring case, diacritics, and whitespace; keep each exact `source_category` in D1/R2 and use canonical labels for display.
- Use a table on wider screens and stacked rows/cards on narrow screens, without horizontal scrolling.
- Do not make athlete names links or add detail pages.

## BFF API

One public endpoint:

```http
GET /api/results?year=2026
```

It returns event metadata and rows, plus the precomputed Total rows. Total rows include `flow_id`; event rows include the original `athlete_id` and resolved `flow_id`. Other row fields are `rank`, `name`, `category`, and decimal `score`; the API converts stored integer hundredths to decimals. The frontend reveals these IDs only in the debug view: `?showid=true` sets a 30-day cookie and removes the parameter from the address; `?showid=false` disables it. Otherwise IDs stay hidden unless the cookie is set. No UI toggle is provided.

Current response shape:

```json
{
  "year": 2026,
  "total": {
    "status": "active",
    "results": [
      { "flow_id": "flow-16006", "rank": 1, "name": "AMBRUS Nagy", "category": "Nyílt - Férfi", "score": 4097.25 }
    ]
  },
  "events": [
    {
      "season": "Autumn",
      "status": "active",
      "results": [
        { "athlete_id": "9332", "flow_id": "flow-16006", "rank": 1, "name": "AMBRUS Nagy", "category": "Nyílt - Férfi", "score": 965.54 }
      ]
    }
  ]
}
```

## D1 tables

The detailed working proposal is in [`docs/d1-schema-plan.md`](docs/d1-schema-plan.md).

- **`events`** — one Flow event slot per `(year, season)`, with a `current_import_id` pointing to its currently published import. The season uses its English name; status comes from the current Vertical-Life payload.
- **`imports`** — one append-only row per accepted upload, with internal `import_id`, Flow `event_pk`, source JSON `event_id` and `id`, R2 key, status, and accepted time. Rejected uploads remain in R2 but have no `imports` row.
- **`upload_receipts`** — records each incoming R2 key and ETag once, including rejected outcomes, so at-least-once Queue deliveries are idempotent.
- **`event_results`** — current normalized ranking rows only. Store `name`, `firstname`, `lastname`, source `athlete_id`, source rank/category, and score in hundredths. Preserve duplicate source entries; a successful re-import replaces the current rows.
- **`"athlete-linking"`** — current `athlete_id` → `flow_id` mapping. `athlete_id` is unique; `flow_id` is not, allowing many-to-one links. Changes overwrite the current mapping; no mapping history is stored. Unreviewed IDs are seeded one-to-one as `flow-<athlete_id>`; reviewed multi-registrations may share a Flow ID.
- **`year_categories`** — current assignment keyed by `(year, flow_id)`. Each accepted import overwrites the category for included athletes; later admin edits or imports are last-write-wins.
- **`total_standings`** — current Worker-generated Total read model keyed by `(year, flow_id)`, containing category, summed score in hundredths, and rank.

Store external numeric identifiers (`event_id`, source `id`, `athlete_id`) as text: they are identifiers, not quantities. Scores use integer hundredths; each event score is rounded to two decimal places on import, then those values are summed for Total. Missing or non-numeric scores become zero.

## Import and publication flow

1. Upload each file under `incoming/{unique-name}.json`. R2 object-created notifications filtered to `incoming/` send messages to the import Queue; the Worker archives the exact raw JSON under a unique `raw-results/` key. Archive writes do not retrigger imports.
2. The source pair `(event_id, id)` identifies the result set. Re-importing a known pair updates that Flow event and appends an accepted `imports` row. An unseen pair creates a new event only if its season slot is unused; otherwise reject it rather than duplicate or overwrite by season name.
3. Reject uploads with missing/invalid source identifiers, missing/unrecognized status, unknown categories, or an unmappable season name. Archive rejected JSON and record a rejected `upload_receipts` row, but create no `imports` row and leave published D1 data unchanged. Missing/non-numeric ranking scores are zero, not import failures.
4. Preserve each original `source_category` string in `event_results`; normalize category matching by case, diacritics, and whitespace, then write the canonical category to `year_categories` for each athlete in the accepted import. The latest import wins; an admin may override it later.
5. Import only the event metadata and ranking entries needed by the public site; the full original payload, including startlists/routes, remains in R2.
6. Publish only after the D1 import and Total regeneration both succeed. In that publication step, replace the event’s current ranking rows, set `events.current_import_id`, update year categories, and publish the regenerated Total atomically. If processing fails, keep serving the previous D1 snapshot and leave the incoming object for Queue retry.

Total includes each athlete’s summed score from every event with published data. An absent result contributes zero; an athlete with at least one published result remains in Total. Active event scores appear in their event tab and are included in Total, so Total is marked active while any published event is active. Rank ties use Vertical-Life competition ranking (`1, 1, 3`). Regenerate Total on accepted source imports and athlete-link or year-category changes.

## Documentation and implementation order

- Product decisions: [`docs/product-decisions.md`](docs/product-decisions.md)
- Domain glossary: [`CONTEXT.md`](CONTEXT.md)
- D1 schema proposal: [`docs/d1-schema-plan.md`](docs/d1-schema-plan.md)
- Frontend/BFF proposal: [`docs/frontend-bff-plan.md`](docs/frontend-bff-plan.md)
- Architecture decision: [`docs/adr/0001-r2-source-archive-and-d1-read-model.md`](docs/adr/0001-r2-source-archive-and-d1-read-model.md)

Implemented: import all three supplied events, confirm reviewed athlete links, expose materialized Total in the BFF, display Total/event tabs, and filter by category. The remaining frontend increment is athlete-name search.

## Import delivery

Queue delivery is at-least-once, so the importer deduplicates by incoming object key and ETag. Each upload should use a new key; archived names add a stable upload hash to avoid timestamp collisions.
