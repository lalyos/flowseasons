# Multi-registration execution notes

**Recorded:** 2026-10-12  
**Status:** Applied to the production D1 database after the organizer confirmed the candidate assumptions.

## Decisions made

1. Applied all **71 distinct event 2 athlete IDs** listed as suspected in [`multi-registration.md`](multi-registration.md). Each is grouped with its matched ID(s) from the supplied event snapshots, including matches based on swapped fields and given-name variations.
2. Mapped **200 distinct Vertical-Life `athlete_id` values into 71 Flow IDs**. This includes IDs found only in a source startlist, not just IDs that have a ranked result.
3. Kept an existing event 1 Flow ID when the group had an existing event 1 link. If it had none, used `flow-<lowest numeric athlete_id in the group>`. This minimizes changes to existing Flow IDs and gives otherwise-unlinked groups a stable, deterministic ID.
4. Kept event ranking rows and source names unchanged. Mapping is used to group athletes for Total; it does not combine or rewrite event results.
5. Consolidated `year_categories` for the newly linked groups using the latest accepted event import's category. If several IDs in a group were present in that same import, preferred the canonical ID's category, then the lowest numeric ID. Removed superseded per-ID category rows and rebuilt the materialized Total standings.
6. Following the organizer's instruction, Total includes scores from every event with published results, including active events. Total is marked active while any event is active because its score may still change.
7. Rebuilt the production Total read model under this rule. It now contains 434 athletes, including provisional Autumn scores.

## Production imports

Uploaded through the configured R2 `incoming/` → Queue → D1 import pipeline. Both source uploads were accepted, archived, and published:

| File | Season | Source identity (`event_id` / `id`) | Status | Ranking rows | Import ID | R2 archive key |
|---|---|---|---|---:|---:|---|
| `flow-2026-2-results.json` | Summer / Nyár | `618` / `7168` | finished | 217 | 2 | `raw-results/618-7168-20261012T155628Z-1303f219bbdb.json` |
| `flow-2026-3-results.json` | Autumn / Ősz | `676` / `8320` | active | 227 | 3 | `raw-results/676-8320-20261012T155640Z-321509c6b5a0.json` |

Event 1 remains import 1 (Spring / Tavasz, finished, 294 ranking rows). The current API data therefore has three events: Spring, Summer, and Autumn.

## Applied Flow ID groups

Each row lists one current `flow_id`, the event 2 name that prompted the review, and every source ID placed in that group. The exact IDs in each group were written to production `athlete-linking`.

| Flow ID | Event 2 name | Linked `athlete_id` values |
|---|---|---|
| `flow-6032` | FÜCSEK Mirkó | 6032, 20251, 23726 |
| `flow-6038` | MOLNÁR Márkó | 6038, 15474 |
| `flow-6093` | NÓRA Jároli | 6093, 18432 |
| `flow-6108` | HÉJJA Boglárka | 6108, 20116, 23737 |
| `flow-6154` | RÉPCEVÖLGYI Csanád | 6154, 20134, 23757 |
| `flow-6756` | RIESING József | 6756, 20135, 23760 |
| `flow-6798` | MOLNÁR Géza | 6798, 20127, 23749 |
| `flow-6806` | HALASI Dorottya | 6806, 20114, 23735 |
| `flow-6807` | NAGY Krisztián | 6807, 20128, 23751 |
| `flow-6861` | SZABÓ-LÁPOSI Helga | 6861, 20138, 23763 |
| `flow-6881` | INDIG Zsuzsa | 6881, 20117, 23738 |
| `flow-6882` | BALÁZS Rebeka | 6882, 20096, 23716 |
| `flow-6948` | KRISKÓ András | 6948, 20122, 23743 |
| `flow-9151` | GUBA Zsófia | 9151, 20112, 23732 |
| `flow-9187` | DÉNES Juhász | 9187, 19853 |
| `flow-9329` | HATALA Réka | 9329, 20115, 23736 |
| `flow-9428` | CSORBA Gergely | 9428, 20102, 23722 |
| `flow-9494` | GERENCSÉR-MÁDL Bendegúz | 9494, 20109, 23729 |
| `flow-9500` | HAJDU Alex | 9500, 20113, 23733 |
| `flow-9531` | GONDA Gábor | 9531, 20111, 23731 |
| `flow-9937` | GIRET Janka | 9937, 20110, 23730 |
| `flow-10269` | FARKAS Tamás | 10269, 18490, 20149 |
| `flow-11853` | KOIKE Ren | 11853, 20133, 23756 |
| `flow-11854` | SHALAMBERIDZE Tamar | 11854, 20139, 23764 |
| `flow-11909` | BORSI Péter | 11909, 20098, 23718 |
| `flow-12570` | DEÁK Borbála | 12570, 20103, 23723 |
| `flow-12667` | PLAGÁNYI Neszta | 12667, 20107 |
| `flow-12675` | FEJÉRVÁRY Dóra | 12675, 20104, 23724 |
| `flow-12676` | FEJÉRVÁRY Roland | 12676, 20105, 23725 |
| `flow-15149` | MIRKÓ Rákos | 12682, 15149 |
| `flow-15150` | SAROSI Samuel | 12656, 15150 |
| `flow-15341` | BENKŐ Bence | 15341, 20097, 23717 |
| `flow-15463` | KÓBER Gergő | 15463, 20071 |
| `flow-15468` | CSÓKA Botond | 15468, 20101, 23721 |
| `flow-15470` | GÁL Soma | 15470, 20106, 23727 |
| `flow-15473` | MAJOR Dávid | 15473, 20125, 23747 |
| `flow-15475` | MOLNÁR Tibor | 6831, 10380, 15475 |
| `flow-15476` | PARRAG Szilárd | 15476, 20129, 23752 |
| `flow-15480` | SZABÓ Dávid | 15480, 20136, 23761 |
| `flow-15481` | SZABÓ Gergő | 15481, 20137, 23762 |
| `flow-15485` | TÓTH Vince | 15485, 20140, 23765 |
| `flow-15497` | NAGY Dorka | 6640, 15497 |
| `flow-17789` | GEISZELHARDT Sára | 17789, 20108, 23728 |
| `flow-17794` | MÁTTYÁSSY Dániel | 17794, 20126, 23748 |
| `flow-17858` | KENDERESI Manna | 17858, 20120, 23741 |
| `flow-17902` | CSEPREGI Brigitta | 17902, 20099, 23719 |
| `flow-18121` | KRASZNAI Márton | 18121, 20121, 23742 |
| `flow-18122` | PETHŐ Gábor | 18122, 20130, 23753 |
| `flow-18234` | LEITOLD Anita | 18234, 20123, 23744 |
| `flow-18246` | CSIZMÁS András | 18246, 20100, 23720 |
| `flow-18249` | KÁRÁNDI Tamás | 18249, 20118, 23739 |
| `flow-18268` | VARGA Pál | 18268, 20141, 23766 |
| `flow-18269` | ZOBOLYÁK Tamás | 18269, 20142, 23767 |
| `flow-18420` | PINTÉR Szilveszter | 18420, 20132, 23755 |
| `flow-18476` | KARDOS Huba | 18476, 20119, 23740 |
| `flow-18479` | LÉNÁRT Zsolt | 18479, 20124, 23745 |
| `flow-18481` | PINTÉR Boldizsár | 18481, 20131, 23754 |
| `flow-18491` | PINTÉR Nikoleta | 18491, 20143, 23768 |
| `flow-18492` | BUBB Ferenc | 18492, 20144, 23769 |
| `flow-18493` | BUBB Tímea | 18493, 20145, 23771 |
| `flow-18494` | TÓTH Viktória | 18494, 20147, 23773 |
| `flow-18495` | CSIGI Móni | 18495, 20148, 23774, 23775 |
| `flow-18496` | KRIZSÁN Veronika | 18496, 20150, 23776 |
| `flow-18499` | GÓDOR Miklós | 18499, 20156 |
| `flow-18500` | TÓTH Marcell | 18500, 20146, 23772 |
| `flow-18503` | GAJÁRSZKI Áron | 18503, 20151, 23777 |
| `flow-19889` | ZALATNAY Zoé Boglárka | 19889, 23937 |
| `flow-20041` | VOROSILOV Veronika | 20041, 23779 |
| `flow-20072` | SZUCSY Peter | 20072, 23783 |
| `flow-20152` | SZÁSZ Krisztián | 20152, 23778 |
| `flow-20293` | KŐVÁRY Ákos | 20293, 23871 |

## Additional organizer-confirmed match

After the event 2 batch, the organizer confirmed another match that was outside that scan:

| Flow ID | Source entries | Linked `athlete_id` values |
|---|---|---|
| `flow-16006` | Spring/Summer `NAGY Ambrus`; Autumn `AMBRUS Nagy` | 16006, 9332 |

`athlete_id` `9332` was updated from its separate seeded link (`flow-9332`) to `flow-16006`. The names and event rows remain as Vertical-Life supplied them; `year_category` is `Nyílt - Férfi` for both. Spring and Summer total 3131.71; active Autumn's provisional 965.54 is now included, making the current Total 4097.25. The current confirmed set is now **72 multi-registration Flow IDs covering 202 source IDs** (the 71 event 2 groups above plus this group).

## Total BFF and frontend

The BFF returns the precomputed `total_standings` rows in `total.results`, alongside unchanged source event rows in `events`. Total's display name is taken from the latest published event where that athlete has a result; ties within that event use the best-ranked source row. Total is marked active while any published event is active.

The frontend shows tabs in this order: **Total**, **Tavasz**, **Nyár**, **Ősz**. Total is the default; both Total and Autumn are marked active. The updated Worker was deployed as version `8e8628ab-bc48-48e6-97aa-fb56675c3b1c` to `https://flowseasons.lalyos22.workers.dev`.

Checks run: `npm test` (5 passing), `wrangler deploy --dry-run`, and a live HTTP request confirming 434 Total rows, Ambrus at 4097.25, and current event counts/statuses (Spring 294/finished, Summer 217/finished, Autumn 227/active). Production D1 verification confirmed all **202 linked source IDs** in the **72 confirmed Flow ID groups**. Source JSON files were not modified.

## Follow-up for later review

- These links reflect the organizer's approved identity assumptions; `athlete-linking` is a current-state table and does not retain previous decisions.
- Nine exact-match event 2 IDs were startlist-only (and some of the name-variation cases are startlist-only). They have been linked, but they contribute no event score unless they appear in a ranking.
- The API and deployed HTML were checked over HTTP; no browser automation or visual screenshot check was performed.
