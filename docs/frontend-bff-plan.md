# Frontend and BFF Plan

**Status:** A minimal Hungarian event-results page and event-only `GET /api/results?year=2026` BFF are deployed. Total and category/name filters are deferred.

## Frontend

- Plain HTML/CSS/JS served by Workers Static Assets; no frontend framework or dependencies.
- `/api/*` runs through the Worker; other static files are served directly.
- Fetch results once on page load; offer a manual retry if the request fails. No polling.
- The first page is event-only: no Total, category filter, or name search.
- Translate season names for display, show event buttons only when multiple events exist, and default to the latest available season.
- Mark active events `Aktív`.
- Show rank, name, canonical category, and score using source-style decimal notation.
- Use the Flow cream/gold palette with a system font; use a table on wide screens and stacked rows on narrow screens without horizontal scrolling.

## BFF

- One public endpoint: `GET /api/results?year=2026`.
- The current staged API reads current event metadata and ranking rows from D1. It intentionally omits Total; Total can be added as a later step.
- Return event status and rows with `rank`, `name`, `category`, and `score` (converted from integer hundredths).
- Return `Cache-Control: no-store` so the next page load sees newly published data.
- No admin or upload endpoints in the POC.

Current staged response shape:

```json
{
  "year": 2026,
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
