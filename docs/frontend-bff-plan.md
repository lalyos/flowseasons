# Frontend and BFF Plan

**Status:** The Worker exposes a deployed event-only `GET /api/results?year=2026` BFF and a minimal JSON test page. Total and the production results UI are deferred.

## Frontend

- Serve the static HTML/CSS/JS assets with Workers Static Assets; the same Worker handles the BFF API.
- Route `/api/*` through Worker logic while allowing ordinary static assets to be served directly; API paths must not fall through to the SPA's HTML response.
- One static, mobile-friendly results page; no athlete detail pages.
- Fetch the 2026 result payload once from the BFF and keep it in page memory.
- Render Total and one tab for each event with published data; mark active events.
- Apply category selection and athlete-name search locally to the selected tab.
- Show rank, name, category, and decimal score. Use a table on wide screens and stacked rows/cards on narrow screens.

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
        { "rank": 1, "name": "Example Athlete", "category": "Open - Men", "score": 1230.85 }
      ]
    }
  ]
}
```
