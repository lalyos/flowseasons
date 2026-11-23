# Admin category and registration review

## Two workspaces

`/xxxadmin` has two views. Both change only Total projections; source event rows and raw uploaded JSON remain untouched.

### Category change — `#categories`

- Lists every known person (Flow ID), including those with just one result/category and known startlist-only registrations.
- Search by name, Flow ID or VL ID.
- **kategóriaváltás — azonos VL ID**: a single VL ID has different canonical categories in current ranked results across events. Different IDs sharing one Flow ID do not create this flag by themselves.
- **assignment mismatch**: the assigned Year category is absent from that person's current ranked source categories. This is a review signal, not proof of error: a deliberate override can differ from the source.
- Admins can set the Year category of any mapped person, even after an identity split removes their old category conflict.
- Categories belong to Flow IDs, not individual VL IDs. The source category remains visible beside each event result.

### multi-reg — `#multi-registration`

Combines the former read-only multi-reg view and collision workflow. Old `#collision` links open this view.

A review case is a set of potentially related registrations, **not an assertion that everyone is one person**. For example, common-name matches can connect three separate people. Each source row displays its current Flow ID.

1. After importing new or updated results, click **Refresh candidates**.
2. Inspect the source names, events, categories, ranks, points and current assignments.
3. Select VL IDs and choose **Kijelöltek összevonása** to draft a merge, or **Mind külön személy** to draft separate people. Individual assignment dropdowns support mixed groups such as A+B together and C separate.
4. Confirm the Year category of **every resulting person**. Changed groups default to their own latest ranked source category, not the old combined person's category. Unchanged groups retain their current assignment.
5. If a resulting person has a same-event collision, choose exactly one counted result for that event.
6. Save the complete decision. Nothing changes merely by editing the draft.

Decisions remain editable in the same case. Splitting is reversible by assigning the IDs to a common Flow ID again. Saving a mixed/separate assignment explicitly records pairwise **keep separate** decisions; re-merging removes the affected separation decisions. Confirming existing assignments is also a decision.

### Filters

- `to-decide`: current evidence/assignments differ from the last reviewed state, or there is no decision.
- `potential match`: the review contains more than one current Flow ID.
- `same-event collision`: one current Flow ID has multiple ranked entries in an event.
- `overlapping event`: multiple candidate entries have results in the same event, even if they currently belong to separate Flow IDs. This warns before a merge introduces a collision (e.g. DABI Gabor).
- `2× score difference`: positive scores under different VL IDs differ by at least a factor of two. Zero scores are not used for this ratio.
- `top-10 impact`: at least one current person is in the top 10 of their Year category, using competition ranks. This does not simulate hypothetical merges/splits or predict future results.
- `merged`: at least two member VL IDs currently share a Flow ID; can also apply to a mixed review group.
- `kept separate`: there is an explicit separation decision within the case; can coexist with `to-decide` after new evidence arrives.

## Candidate refresh and evidence

Refresh scans **all known IDs across all events**, not only IDs new to the latest upload. This catches cases like VADÁSZ Gábor, whose Winter ID already appeared in Autumn.

Detection uses current D1 rankings plus archived R2 rankings and startlists. Matching ignores accents/case/punctuation and checks exact names, swapped first/last fields, given-name token subsets with a matching surname, and conservative one-character variants. Name matching is evidence for review, never authorization to merge.

Existing mappings and saved review memberships also connect registrations into stable review containers. Existing separation decisions stay visible, rather than deleting candidates and losing the ability to revise them. Overlapping containers are consolidated; an enlarged or materially changed case becomes `to-decide` again.

A refresh:

- Never changes identity mappings, Year categories, counted results, or Total scores.
- Preserves the stable case ID through merges and splits.
- Retains reviewed status when source evidence, assignments, counted choices and separation decisions have not changed.
- Reopens review for new IDs or changed event evidence/assignments. A mere scan timestamp or standings-rank change does not reopen it.
- Refuses to refresh or save identity decisions if referenced R2 archives are missing, rather than silently dropping evidence.

GET requests do not persist or recalculate candidate membership. They display live evidence for saved cases, so changed scores can show as `to-decide` even before refresh. New IDs enter cases on explicit refresh. **Imports do not automatically run the expensive name scan**; use the refresh button after every upload. Public result requests never run it.

Archived-only rows retain their recorded names/events but show dashes for current rank/points. They are marked `archív`; old scores are not resurrected into Total.

## Storage and safety

Migration: `migrations/0005_registration_review.sql`.

- `athlete-linking`: current mapping; unchanged structure.
- `year_categories.origin`: `import`, `admin`, or `legacy`. Imports update only import-derived assignments. Existing assignments are conservatively `legacy` because old provenance is unknowable; neither legacy nor explicit admin assignments are silently overwritten by later imports. Saving a category/identity decision marks confirmed categories `admin`.
- `registration_review_cases`: stable case ID, member IDs, evidence, reason labels, current decision, and reviewed evidence signature. These are current projections, not an immutable event log.
- `registration_separations`: ordered VL ID pairs explicitly assigned to different people.
- `event_result_choices`: current counted entry for a Flow ID/import snapshot. Replacing an import deletes obsolete selections before deleting its result rows.
- `registration_review_write_guards`: transient assertions inside the same transaction, preventing concurrent mapping/import changes from silently clobbering a reviewed decision.

The migration copies legacy collision cases and explicit legacy split decisions without changing existing mappings, categories or totals. Since only the latest old decision was retained, overwritten historical decisions cannot be reconstructed. A first refresh retains explicit migrated decisions when case membership is unchanged; newly detected members reopen the review. The old `collision_cases` table is retained as a read-only legacy record.

Saving validates complete membership, allowed destinations, category choices and counted entries on the server. It rejects stale evidence and out-of-case identity changes. Mapping updates, separation decisions, all resulting Year categories, obsolete category cleanup, result selections, the reviewed state and Total rebuilding commit in a single D1 batch.

If a new import introduces an unresolved same-event collision, that event contributes no score until an admin chooses an entry or separates the people. Total still uses the best three scores for athletes with four event scores.

## Endpoints

All require `?year=2026` and return `Cache-Control: no-store`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin/year-categories` | GET | All people, source evidence, category flags and assignment origin |
| `/api/admin/year-categories` | POST | Set `{flow_id, category}` for any mapped person |
| `/api/admin/registration-reviews` | GET | Saved cases with current evidence, assignments and review status |
| `/api/admin/registration-reviews/refresh` | POST | Recompute candidates without changing mappings/scores |
| `/api/admin/registration-reviews` | POST | Save `{case_id, signature, assignments, categories, choices}` |

A decision supplies one `{athlete_id, flow_id}` assignment per member, one `{flow_id, category}` per resulting person, and one `{import_id, flow_id, entry_id}` choice per resulting same-event collision. A changed signature or concurrent change returns HTTP 409; reload before deciding again. No choice is required when there is no collision.

Old `/api/admin/collisions` and `/api/admin/multi-registrations` endpoints return HTTP 410 with a reload message, preventing stale UI clients from using the old unsafe split/category behavior.

## Deployment and local validation

Back up D1, apply migration 0005, then deploy the matching Worker/assets. Do not deploy the new API against an unmigrated database.

```bash
npx wrangler d1 migrations apply flowseasons --local
npx wrangler dev
```

For production, use `--remote` only after an explicit deployment decision. Deploying code does not copy local R2 data, mappings or admin decisions. No production data changes are part of implementing this UI.

Tests use Node's built-in SQLite (`node:sqlite`; tested with Node 24) to exercise the actual migrations and Total SQL. Run `npm test`. Coverage includes the stranded FARKAS category regression, missed existing Winter IDs, partial merges, persistent separations, re-merges, same-event selections, stale/concurrent writes, provenance, import replacement cleanup and migration of old decisions.

**Security:** `/xxxadmin` and its API remain unauthenticated POC endpoints. Protect both the page and `/api/admin/*` with external access control before exposing write functionality to untrusted users.
