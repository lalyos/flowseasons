# Frontend and BFF Plan

**Status:** The Hungarian results page and `GET /api/results?year=2026` BFF display materialized Total standings, current event rows, and a page-wide category filter. Name search is deferred.

## Frontend

- Plain HTML/CSS/JS served by Workers Static Assets; no frontend framework or dependencies.
- `/api/*` runs through the Worker; other static files are served directly.
- Fetch results once on page load; offer a manual retry if the request fails. No polling.
- The first page includes a Total tab, one tab per published event, and a page-wide category filter. A selected category is ranked from 1 within that category (competition ties preserved); Everyone retains overall ranks. Name search is deferred.
- Translate season names for display, show result-view buttons when multiple tabs exist, and default to Total.
- Show the `Aktív` badge in the selected event heading; keep event-tab labels to season names only.
- Show rank, name, canonical category, and score using source-style decimal notation.
- Use the Flow cream/gold palette with a system font; use a table on wide screens and stacked rows on narrow screens without horizontal scrolling.

## BFF

- One public endpoint: `GET /api/results?year=2026`.
- Read current event metadata/ranking rows and the materialized `total_standings` read model from D1; public requests do not recalculate Total.
- Return Total rows with `flow_id`; event rows also include the original `athlete_id` and resolved `flow_id`. Names remain source names. IDs are hidden by default and revealed by the debug-only `?showid=true` preference, persisted in a 30-day cookie; `?showid=false` disables it. The parameter is removed from the address after it is applied, and no UI toggle is provided. Scores are converted from integer hundredths. Total includes available published event scores, using the best three for athletes with four event scores, and is `active` while any event is active. Its display name comes from the latest event containing the athlete, preferring the best-ranked source row within that event.
- Return `Cache-Control: no-store` so the next page load sees newly published data.
- The unlinked POC admin page uses `/api/admin/year-categories` for all-athlete category editing and `/api/admin/registration-reviews` (plus its `/refresh` action) for candidate discovery and reversible identity decisions. Old multi-registrations/collisions endpoints return 410. Writes atomically update current projections, confirm resulting Year categories, and rebuild Total. These admin endpoints are intentionally unauthenticated until external access control is added. See [admin review](admin-review.md).
- No public upload endpoint.

Response shape:

```json
{
  "year": 2026,
  "total": {
    "status": "finished",
    "results": [
      { "flow_id": "flow-123", "rank": 1, "name": "Example Athlete", "category": "Nyílt - Férfi", "score": 1230.85 }
    ]
  },
  "events": [
    {
      "season": "Spring",
      "status": "finished",
      "results": [
        { "athlete_id": "123", "flow_id": "flow-123", "rank": 1, "name": "Example Athlete", "category": "Nyílt - Férfi", "score": 1230.85 }
      ]
    }
  ]
}
```
