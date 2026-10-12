# Frontend and BFF Plan

**Status:** The Hungarian results page and `GET /api/results?year=2026` BFF display materialized Total standings and current event rows. Category/name filters are deferred.

## Frontend

- Plain HTML/CSS/JS served by Workers Static Assets; no frontend framework or dependencies.
- `/api/*` runs through the Worker; other static files are served directly.
- Fetch results once on page load; offer a manual retry if the request fails. No polling.
- The first page includes a Total tab and one tab per published event. Category filtering and name search are deferred.
- Translate season names for display, show result-view buttons when multiple tabs exist, and default to Total.
- Mark active events `Aktív`.
- Show rank, name, canonical category, and score using source-style decimal notation.
- Use the Flow cream/gold palette with a system font; use a table on wide screens and stacked rows on narrow screens without horizontal scrolling.

## BFF

- One public endpoint: `GET /api/results?year=2026`.
- Read current event metadata/ranking rows and the materialized `total_standings` read model from D1; public requests do not recalculate Total.
- Return Total and event rows with `rank`, `name`, `category`, and `score` (converted from integer hundredths). Event names remain source names. Total includes scores from all published events, and is `active` while any event is active. Its display name comes from the latest event containing the athlete, preferring the best-ranked source row within that event.
- Return `Cache-Control: no-store` so the next page load sees newly published data.
- No admin or upload endpoints in the POC.

Response shape:

```json
{
  "year": 2026,
  "total": {
    "results": [
      { "rank": 1, "name": "Example Athlete", "category": "Nyílt - Férfi", "score": 1230.85 }
    ]
  },
  "events": [
    {
      "season": "Spring",
      "status": "finished",
      "results": [
        { "rank": 1, "name": "Example Athlete", "category": "Nyílt - Férfi", "score": 1230.85 }
      ]
    }
  ]
}
```
