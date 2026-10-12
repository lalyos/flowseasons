# Flow Seasons Results — Product Decisions

## Scope

- The site presents results for one specified Flow Seasons year.
- A Flow Seasons year has four events.

## Navigation and category view

- Results are organized into a **Total** tab and one tab per event.
- **Total** is the default tab.
- Finished and active events are shown. Active events are visibly marked **Active**.
- A single page-wide category chooser sits above the result tabs and applies to every tab.
- The chooser includes **Everyone** and categories. **Everyone** is the default and combines participants from all categories.
- Category-specific rankings are a must-have.
- Each athlete has one admin-assigned **year category** for the whole year; it affects Total standings only.

## Public and admin experiences

- The visitor-facing results experience is a single-page app and must be mobile-friendly.
- Admin tools are separate from the visitor page and may be more elaborate.
- Each person has one stable Flow ID (`flow_id`); multiple original Vertical-Life `athlete_id` values may be associated with it.
- Event tabs preserve the source entries and categories as provided. If the same person has multiple source entries, they remain separate in the event results.
- Admins need to record athlete-ID mappings and year-category assignments as separate decisions. Each change is a new record; prior decisions and original data are retained. These decisions must not merge or replace source data and affect Total standings only.

## Cloudflare tooling

- Use Wrangler CLI; do not install or use the beta `cf` CLI for now.

## Result data updates

- Admins manually upload the Vertical-Life result data; the site does not automatically sync from Vertical-Life.
- A new upload becomes visitor-visible immediately.
- D1 Time Travel is the recovery mechanism; no application-level upload-version history is planned. Time Travel restores the whole database to an earlier point, with a retention window of 7 days on Workers Free or 30 days on Workers Paid. Confirm the deployed database uses D1's production storage backend.
- Uploaded source data is kept separate from athlete-ID mappings and year-category decisions; admin decisions do not rewrite the source results.

## Total standings

- Total is an interim ranking, summing each athlete’s event `score` from finished events to date. Source `athlete_id`s mapped to the same `flow_id` are grouped for Total.
- Total ranks by summed score using Vertical-Life’s competition-ranking rule: ties share a rank and subsequent ranks skip (for example, `1, 1, 3`).
- Total uses each athlete’s admin-assigned year category; Everyone combines all categories.
- A missing result in a finished event contributes zero; an athlete with at least one finished-event result remains in Total.
- An active event’s provisional score is shown in that event’s tab but is not included in Total until the event is finished.
- The Total ranking becomes final after all four events are finished.
