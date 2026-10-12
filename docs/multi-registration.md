# Multi-registration

## Meaning

A **multi-registration** is a suspected case where one athlete has more than one Vertical-Life `athlete_id`, usually because they registered again after forgetting which email/login they had used. The second registration may use a different name or a differently entered version of the same name.

Common name variations include:

- first and last names swapped;
- multiple given names on one registration, but only one on the other;
- Hungarian accents omitted or entered with an English keyboard (`a`/`á`, `e`/`é`, `i`/`í`, etc.);
- a space, punctuation, or one-letter typo.

A name match is a **lead for review**, not proof that two IDs belong to the same person. Do not merge IDs automatically based on names alone. Once confirmed, multiple Vertical-Life IDs can be associated with one stable Flow ID; see the athlete ID mapping language in [`../CONTEXT.md`](../CONTEXT.md).

## Review of the 2026 source files

Reviewed `flow-2026-1-results.json` (Tavasz), `flow-2026-2-results.json` (Nyár), and `flow-2026-3-results.json` (Ősz). Both `ranking` and `startlist` entries were included when collecting IDs.

### Source consistency check

For IDs present in both files, the source `name`, `firstname`, and `lastname` fields were identical:

- Events 1 and 2: 121 shared IDs, no name-field changes.
- Events 2 and 3: 105 shared IDs, no name-field changes.
- Events 1 and 3: 101 shared IDs, no name-field changes.

Within each file, an ID appearing in both `ranking` and `startlist` also had the same name fields. This makes differing IDs—not name changes on a shared ID—the useful signal in this comparison.

### Matching method and limits

An event 2 ID was considered new relative to event 1 when it appeared in neither event 1's ranking nor its startlist. Names were compared using `firstname` and `lastname`:

- case-insensitive, accent-insensitive Unicode normalization (including Hungarian accents);
- spaces and punctuation ignored within each name part;
- exact first/last matches, with a separate check for swapped fields;
- a separate check for a shared surname where one given-name token set is contained in the other;
- a conservative one-character check when one name part matched exactly.

Event 3 is included as later corroboration, not as evidence that an ID existed before event 2. The method only compares these three supplied snapshots; it does not establish a person's identity. Common names can produce false positives, and registration/startlist presence does not mean the athlete has a result.

### Suspected matches in event 2

There are 262 distinct event 2 IDs across ranking and startlist; 141 do not occur in event 1. Of those 141:

- **63 IDs** have an exact normalized first-and-last-name match under a different ID in event 1 or event 3;
- **4 more IDs** have the first and last name fields swapped relative to an ID in another event;
- **4 more IDs** have the same normalized surname and a given-name token-subset match;
- no additional candidate was found by the conservative one-character-only check.

That is **71 distinct event 2 IDs to review**. Some have more than one possible existing ID; some also match exactly in one event while showing a name variation against another ID in another event.

`*` means the event 2 ID appears in the startlist but not the ranking (no event 2 rank).

#### Exact normalized name matches

The event 1 and event 3 columns list other IDs with the same normalized first and last names. A dash means no such match in that file.

| Event 2 ID | Event 2 name | Event 1 ID(s) | Event 3 ID(s) |
|---:|---|---:|---:|
| 6038 | MOLNÁR Márkó | — | 15474 |
| 20041 | VOROSILOV Veronika | — | 23779 |
| 20072 | SZUCSY Peter | — | 23783 |
| 20096 | BALÁZS Rebeka | 6882 | 23716 |
| 20097 | BENKŐ Bence | 15341 | 23717 |
| 20098 | BORSI Péter | 11909 | 23718 |
| 20099 | CSEPREGI Brigitta | 17902 | 23719 |
| 20100 | CSIZMÁS András | 18246 | 23720 |
| 20101* | CSÓKA Botond | 15468 | 23721 |
| 20102* | CSORBA Gergely | 9428 | 23722 |
| 20103 | DEÁK Borbála | 12570 | 23723 |
| 20104 | FEJÉRVÁRY Dóra | 12675 | 23724 |
| 20105* | FEJÉRVÁRY Roland | 12676 | 23725 |
| 20106 | GÁL Soma | 15470 | 23727 |
| 20107 | PLAGÁNYI Neszta | 12667 | — |
| 20108 | GEISZELHARDT Sára | 17789 | 23728 |
| 20109 | GERENCSÉR-MÁDL Bendegúz | 9494 | 23729 |
| 20110 | GIRET Janka | 9937 | 23730 |
| 20111* | GONDA Gábor | 9531 | 23731 |
| 20112 | GUBA Zsófia | 9151 | 23732 |
| 20113 | HAJDU Alex | 9500 | 23733 |
| 20114 | HALASI Dorottya | 6806 | 23735 |
| 20115 | HATALA Réka | — | 23736 |
| 20116 | HÉJJA Boglárka | 6108 | 23737 |
| 20117 | INDIG Zsuzsa | — | 23738 |
| 20118 | KÁRÁNDI Tamás | 18249 | 23739 |
| 20119 | KARDOS Huba | 18476 | 23740 |
| 20120 | KENDERESI Manna | 17858 | 23741 |
| 20121 | KRASZNAI Márton | — | 23742 |
| 20122 | KRISKÓ András | 6948 | 23743 |
| 20123 | LEITOLD Anita | 18234 | 23744 |
| 20124 | LÉNÁRT Zsolt | 18479 | 23745 |
| 20125* | MAJOR Dávid | 15473 | 23747 |
| 20126 | MÁTTYÁSSY Dániel | 17794 | 23748 |
| 20127 | MOLNÁR Géza | 6798 | 23749 |
| 20128 | NAGY Krisztián | 6807 | 23751 |
| 20129 | PARRAG Szilárd | 15476 | 23752 |
| 20130 | PETHŐ Gábor | 18122 | 23753 |
| 20131* | PINTÉR Boldizsár | 18481 | 23754 |
| 20132 | PINTÉR Szilveszter | 18420 | 23755 |
| 20133 | KOIKE Ren | 11853 | 23756 |
| 20134 | RÉPCEVÖLGYI Csanád | 6154 | 23757 |
| 20135* | RIESING József | 6756 | 23760 |
| 20136 | SZABÓ Dávid | 15480 | 23761 |
| 20137* | SZABÓ Gergő | 15481 | 23762 |
| 20138 | SZABÓ-LÁPOSI Helga | 6861 | 23763 |
| 20139 | SHALAMBERIDZE Tamar | 11854 | 23764 |
| 20140 | TÓTH Vince | 15485 | 23765 |
| 20141 | VARGA Pál | 18268 | 23766 |
| 20142 | ZOBOLYÁK Tamás | 18269 | 23767 |
| 20143 | PINTÉR Nikoleta | 18491 | 23768 |
| 20144 | BUBB Ferenc | 18492 | 23769 |
| 20145 | BUBB Tímea | 18493 | 23771 |
| 20146 | TÓTH Marcell | 18500 | 23772 |
| 20147 | TÓTH Viktória | 18494 | 23773 |
| 20148 | CSIGI Móni | 18495 | 23774, 23775 |
| 20149 | FARKAS Tamás | 10269, 18490 | — |
| 20150 | KRIZSÁN Veronika | 18496 | 23776 |
| 20151* | GAJÁRSZKI Áron | 18503 | 23777 |
| 20152 | SZÁSZ Krisztián | — | 23778 |
| 20156 | GÓDOR Miklós | 18499 | — |
| 20251 | FÜCSEK Mirkó | 6032 | 23726 |
| 20293 | KŐVÁRY Ákos | — | 23871 |

#### Name-order and given-name variations

These are additional name-variation signals. Some event 2 IDs also appear in the exact-match table because they have another exact-name match in a different event.

| Event 2 ID | Event 2 name | Possible other ID and source name | Signal |
|---:|---|---|---|
| 12682 | MIRKÓ Rákos | 15149 — RÁKOS Mirkó (events 1 and 3) | First/last swapped |
| 18432 | NÓRA Jároli | 6093 — JÁROLI Nóra (events 1 and 3) | First/last swapped |
| 19853* | DÉNES Juhász | 9187 — JUHÁSZ Dénes (event 1) | First/last swapped |
| 20071* | KÓBER Gergő | 15463 — GERGŐ Kóber (event 1) | First/last swapped |
| 20117 | INDIG Zsuzsa | 6881 — ZSUZSA Indig (event 1) | First/last swapped; also exact match in event 3 |
| 6640 | NAGY Dorka | 15497 — NAGY Dorka Anna (events 1 and 3) | One registration has an additional given name |
| 6831 | MOLNÁR Tibor | 15475 — MOLNÁR Tibor Péter (event 1); 10380 — MOLNAR Tibor Peter (event 3) | One registration has an additional given name |
| 12656* | SAROSI Samuel | 15150 — SÁROSI Sámuel Balázs (events 1 and 3) | Accent variation and an additional given name |
| 20115 | HATALA Réka | 9329 — HATALA Réka Erzsébet (event 1) | One registration has an additional given name; also exact match in event 3 |
| 20121 | KRASZNAI Márton | 18121 — KRASZNAI Márton János (event 1) | One registration has an additional given name; also exact match in event 3 |
| 19889 | ZALATNAY Zoé Boglárka | 23937 — ZALATNAY Zoé (event 3) | One registration has an additional given name |

## Additional confirmed match outside the event 2 scan

The organizer also confirmed that Autumn athlete `9332` (`AMBRUS Nagy`) is the same athlete as Spring/Summer athlete `16006` (`NAGY Ambrus`). The first/last fields are swapped. This ID was outside the event 2 “new ID” scan, so it was handled separately and linked to `flow-16006`.

## Review outcome

The organizer reviewed the listed event 2 candidates and confirmed the multi-registration assumptions for that set. The corresponding Vertical-Life IDs were linked to shared Flow IDs in the production `athlete-linking` table. See [the execution notes](multi-registration-execution-notes.md) for the canonical Flow ID choices and complete ID groups, including the additional `9332` → `flow-16006` link.

The source event rows and source names were left unchanged. These links affect Total standings only; separate entries remain separate in each event's results. Future name-based candidates still require review—similar names alone are not proof of identity.
