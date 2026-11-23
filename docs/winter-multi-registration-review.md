# Winter 2026 multi-registration candidates

## Status

All 66 candidates below were applied locally and subsequently to production after the organizer approved the complete candidate set and explicitly requested production application. The Winter active snapshot is `751` / `9344`. Similar names remain review signals, not proof of identity.

## Method

Compared Winter ranking and startlist IDs not seen in Spring–Autumn against both rankings and startlists from those events, including the earlier active Autumn snapshot. Matching ignores case, accents and punctuation; checks exact first/last names, swapped fields, given-name token subsets with an exact surname, and conservative one-character variations when the other name part matches exactly. Existing local Athlete ID mappings identify the proposed Flow IDs. IDs already present in earlier events are not new candidates.

## Summary

- 258 distinct Winter IDs: 143 already seen in earlier events and 115 new.
- 66 new IDs have a potential earlier match: 45 ranked and 21 startlist-only.
- 49 new Winter IDs have no match under these conservative rules.
- By strongest signal: 62 exact normalized matches, 3 swapped-name matches, 1 given-name subset match, and no additional one-character-only matches.
- No candidate points to more than one existing Flow ID. This does not establish identity.

### Review highlights

- BUBB Ferenc: Winter `25813` → proposed `flow-18492` (118.97 points).
- BUBB Tímea: Winter `25814` → proposed `flow-18493` (startlist only).
- GIRET Janka has two new Winter IDs matching `flow-9937`: `25774` is ranked and `25775` is startlist-only. This would not be a same-event collision because only one entry has a ranked result.
- Swapped-name-only candidates: `10275` ATTILA Szasz → `flow-16008`; `25175` FISCHER Lili → `flow-16014`; `25443` MÁTÉ Mindák → `flow-6637`.
- Given-name-subset-only candidate: `15466` BLISZKÓ Péter → `flow-6053` (BLISZKÓ Péter Albert).
- All 66 IDs are now linked to the 65 target Flow IDs below and visible in the local admin multi-reg view.

## Local application

- Backed up local state to `/tmp/flow-before-winter-mappings-20261122-232645` before applying.
- Upserted all 66 Athlete ID mappings, including startlist-only IDs that previously had no mapping.
- Applied Winter source categories to target Flow IDs with Winter ranking rows; startlist-only mappings do not overwrite Year categories.
- Removed orphaned Year category assignments and rebuilt Total atomically with the mapping changes.
- Total rows decreased from 530 to 485; category conflicts stayed at 27. The collision view now retains 54 cases (including earlier cases), versus 30 before these mappings.
- Verified BUBB Ferenc (`flow-18492`) now includes Winter ID `25813` and has a best-three Total of 398.95.
- These are replaceable current mappings, not immutable identity decisions.

## Production application — 2026-11-23

- Validated all 66 IDs and their source names against production's newer Winter snapshot (220 ranking rows).
- Backed up production D1 to `/tmp/flow-prod-before-winter-mappings-20261123-083504.sql`.
- Applied all 66 mappings and rebuilt Total in one atomic import; verified every assignment afterward. Source result rows were not changed.
- Preserved existing destination Year categories, including HAVASI Gábor (`flow-18184`, Hobbi - Férfi) and BLISZKÓ Péter (`flow-6053`, Hobbi - Férfi), whose Winter source categories differ and remain available for category review.
- Preserved all 23 saved collision decisions during mapping application. Refreshing the collision projection then reopened cases whose VL ID membership changed, as designed.
- Verified 485 Total athletes, BUBB Ferenc at 398.95 with all four VL IDs in one collision table, and healthy production D1/R2 checks.
- After refresh, production has 33 saved collision cases, 26 awaiting an admin decision.

## Candidates

Rank is the source Winter overall rank, not category rank. A dash in rank/score means startlist-only. The target Flow IDs below reflect the organizer-approved local mappings.

| Winter VL ID | Winter name | Rank | Score | Matching prior VL IDs and names | Applied Flow ID | Signals |
|---|---|---:|---:|---|---|---|
| 10275 | ATTILA Szasz | 3 | 922.53 | 16008: SZÁSZ Attila | flow-16008 | first/last swapped |
| 25778 | HAJDU Alex | 4 | 720.98 | 9500: HAJDU Alex; 20113: HAJDU Alex; 23733: HAJDU Alex | flow-9500 | exact normalized name |
| 20294 | BÖRÖCZKY Ferenc László | 11 | 437.68 | 20292: BÖRÖCZKY Ferenc László | flow-20292 | exact normalized name |
| 25804 | RÉPCEVÖLGYI Csanád | 12 | 430.67 | 6154: RÉPCEVÖLGYI Csanád; 20134: RÉPCEVÖLGYI Csanád; 23757: RÉPCEVÖLGYI Csanád | flow-6154 | exact normalized name |
| 25810 | TÓTH Vince | 15 | 336.24 | 15485: TÓTH Vince; 20140: TÓTH Vince; 23765: TÓTH Vince | flow-15485 | exact normalized name |
| 25175 | FISCHER Lili | 17 | 295.39 | 16014: LILI Fischer | flow-16014 | first/last swapped |
| 25711 | GÓBOR Jázmin | 23 | 243.39 | 16015: GÓBOR Jázmin | flow-16015 | exact normalized name |
| 25816 | TÓTH Viktória | 25 | 222.46 | 18494: TÓTH Viktória; 20147: TÓTH Viktória; 23773: TÓTH Viktória | flow-18494 | exact normalized name |
| 25773 | GERENCSÉR-MÁDL Bendegúz | 40 | 164.17 | 9494: GERENCSÉR-MÁDL Bendegúz; 20109: GERENCSÉR-MÁDL Bendegúz; 23729: GERENCSÉR-MÁDL Bendegúz | flow-9494 | exact normalized name |
| 25797 | MOLNÁR Géza | 45 | 142.96 | 6798: MOLNAR Geza; 20127: MOLNÁR Géza; 23749: MOLNÁR Géza | flow-6798 | exact normalized name |
| 25764 | CSIZMÁS András | 47 | 138.85 | 18246: CSIZMÁS András; 20100: CSIZMÁS András; 23720: CSIZMÁS András | flow-18246 | exact normalized name |
| 25774 | GIRET Janka | 57 | 122.3 | 9937: GIRET Janka; 20110: GIRET Janka; 23730: GIRET Janka | flow-9937 | exact normalized name |
| 25813 | BUBB Ferenc | 63 | 118.97 | 18492: BUBB Ferenc; 20144: BUBB Ferenc; 23769: BUBB Ferenc | flow-18492 | exact normalized name |
| 12444 | HAVASI Gábor | 64 | 116.52 | 18184: HAVASI Gabor | flow-18184 | exact normalized name |
| 25761 | BENKŐ Bence | 81 | 102.1 | 15341: BENKŐ Bence; 20097: BENKŐ Bence; 23717: BENKŐ Bence | flow-15341 | exact normalized name |
| 25837 | ZOBOLYÁK Tamás | 88 | 97.23 | 18269: ZOBOLYÁK Tamás; 20142: ZOBOLYÁK Tamás; 23767: ZOBOLYÁK Tamás | flow-18269 | exact normalized name |
| 25845 | KÉRI Viktor | 90 | 97.22 | 6058: KERI Viktor | flow-6058 | exact normalized name |
| 25776 | GONDA Gábor | 93 | 95.71 | 9531: GONDA Gábor; 20111: GONDA Gábor; 23731: GONDA Gábor | flow-9531 | exact normalized name |
| 25818 | SZÜCSY Péter | 96 | 94.45 | 20072: SZUCSY Peter; 23783: SZÜCSY Péter | flow-20072 | exact normalized name |
| 25815 | TÓTH Marcell | 99 | 93.3 | 18500: TÓTH Marcell; 20146: TÓTH Marcell; 23772: TÓTH Marcell | flow-18500 | exact normalized name |
| 25807 | SZABÓ Gergő | 112 | 86.54 | 15481: SZABÓ Gergő; 20137: SZABÓ Gergő; 23762: SZABÓ Gergő | flow-15481 | exact normalized name |
| 25803 | KOIKE Ren | 121 | 83.23 | 11853: KOIKE Ren; 20133: KOIKE Ren; 23756: KOIKE Ren | flow-11853 | exact normalized name |
| 25790 | KARDOS Huba | 131 | 78.89 | 18476: KARDOS Huba; 20119: KARDOS Huba; 23740: KARDOS Huba | flow-18476 | exact normalized name |
| 25811 | VARGA Pál | 133 | 78.0 | 18268: VARGA Pal; 20141: VARGA Pál; 23766: VARGA Pál | flow-18268 | exact normalized name |
| 25767 | DEÁK Borbála | 137 | 77.03 | 12570: DEÁK Borbála; 20103: DEÁK Borbála; 23723: DEÁK Borbála | flow-12570 | exact normalized name |
| 25770 | FÜCSEK Mirkó | 141 | 76.64 | 6032: FÜCSEK Mirkó; 20251: FÜCSEK Mirkó; 23726: FÜCSEK Mirkó | flow-6032 | exact normalized name |
| 25792 | KRASZNAI Márton | 144 | 75.95 | 18121: KRASZNAI Márton János; 20121: KRASZNAI Márton; 23742: KRASZNAI Márton | flow-18121 | given-name token subset; exact normalized name |
| 25768 | FEJÉRVÁRY Dóra | 153 | 74.88 | 12675: FEJÉRVÁRY Dóra; 20104: FEJÉRVÁRY Dóra; 23724: FEJÉRVÁRY Dóra | flow-12675 | exact normalized name |
| 25844 | KÉZSMÁRKI Málna Zsófia | 162 | 73.7 | 18261: KÉZSMÁRKI Málna Zsófia | flow-18261 | exact normalized name |
| 11877 | CSANÁDI Richárd | 169 | 72.46 | 18229: CSANÁDI Richárd | flow-18229 | exact normalized name |
| 25772 | GEISZELHARDT Sára | 173 | 71.71 | 17789: GEISZELHARDT Sara; 20108: GEISZELHARDT Sára; 23728: GEISZELHARDT Sára | flow-17789 | exact normalized name |
| 25760 | BALÁZS Rebeka | 174 | 71.38 | 6882: BALÁZS Rebeka; 20096: BALÁZS Rebeka; 23716: BALÁZS Rebeka | flow-6882 | exact normalized name |
| 25798 | NAGY Krisztián | 174 | 71.38 | 6807: NAGY Krisztián; 20128: NAGY Krisztián; 23751: NAGY Krisztián | flow-6807 | exact normalized name |
| 25809 | SHALAMBERIDZE Tamar | 177 | 71.13 | 11854: SHALAMBERIDZE Tamar; 20139: SHALAMBERIDZE Tamar; 23764: SHALAMBERIDZE Tamar | flow-11854 | exact normalized name |
| 15466 | BLISZKÓ Péter | 178 | 70.95 | 6053: BLISZKÓ Péter Albert | flow-6053 | given-name token subset |
| 25782 | HATALA Réka | 179 | 70.81 | 9329: HATALA Réka Erzsébet; 20115: HATALA Réka; 23736: HATALA Réka | flow-9329 | given-name token subset; exact normalized name |
| 25796 | MÁTTYÁSSY Dániel | 184 | 69.71 | 17794: MÁTTYÁSSY Dániel; 20126: MÁTTYÁSSY Dániel; 23748: MÁTTYÁSSY Dániel | flow-17794 | exact normalized name |
| 25766 | CSORBA Gergely | 187 | 69.13 | 9428: CSORBA Gergely; 20102: CSORBA Gergely; 23722: CSORBA Gergely | flow-9428 | exact normalized name |
| 25780 | HALASI Dorottya | 187 | 69.13 | 6806: HALASI Dorottya; 20114: HALASI Dorottya; 23735: HALASI Dorottya | flow-6806 | exact normalized name |
| 25794 | LEITOLD Anita | 198 | 64.04 | 18234: LEITOLD Anita; 20123: LEITOLD Anita; 23744: LEITOLD Anita | flow-18234 | exact normalized name |
| 25801 | PINTÉR Boldizsár | 199 | 63.35 | 18481: PINTÉR Boldizsár; 20131: PINTÉR Boldizsár; 23754: PINTÉR Boldizsár | flow-18481 | exact normalized name |
| 25802 | PINTÉR Szilveszter | 201 | 59.97 | 18420: PINTÉR Szilveszter; 20132: PINTÉR Szilveszter; 23755: PINTÉR Szilveszter | flow-18420 | exact normalized name |
| 25786 | INDIG Zsuzsa | 202 | 59.59 | 6881: ZSUZSA Indig; 20117: INDIG Zsuzsa; 23738: INDIG Zsuzsa | flow-6881 | first/last swapped; exact normalized name |
| 25769 | FEJÉRVÁRY Roland | 208 | 57.67 | 12676: FEJÉRVÁRY Roland; 20105: FEJÉRVÁRY Roland; 23725: FEJÉRVÁRY Roland | flow-12676 | exact normalized name |
| 25795 | LÉNÁRT Zsolt | 214 | 45.56 | 18479: LÉNÁRT Zsolt; 20124: LÉNÁRT Zsolt; 23745: LÉNÁRT Zsolt | flow-18479 | exact normalized name |
| 15553 | NAGY Dorka | — | — | 15497: NAGY Dorka Anna; 6640: NAGY Dorka | flow-15497 | given-name token subset; exact normalized name |
| 25443 | MÁTÉ Mindák | — | — | 6637: MINDÁK Máté | flow-6637 | first/last swapped |
| 25762 | BORSI Péter | — | — | 11909: BORSI Péter; 20098: BORSI Péter; 23718: BORSI Péter | flow-11909 | exact normalized name |
| 25763 | CSEPREGI Brigitta | — | — | 17902: CSEPREGI Brigitta; 20099: CSEPREGI Brigitta; 23719: CSEPREGI Brigitta | flow-17902 | exact normalized name |
| 25765 | CSÓKA Botond | — | — | 15468: CSÓKA Botond; 20101: CSÓKA Botond; 23721: CSÓKA Botond | flow-15468 | exact normalized name |
| 25771 | GÁL Soma | — | — | 15470: GÁL Soma; 20106: GÁL Soma; 23727: GÁL Soma | flow-15470 | exact normalized name |
| 25775 | GIRET Janka | — | — | 9937: GIRET Janka; 20110: GIRET Janka; 23730: GIRET Janka | flow-9937 | exact normalized name |
| 25777 | GUBA Zsófia | — | — | 9151: GUBA Zsofia; 20112: GUBA Zsófia; 23732: GUBA Zsófia | flow-9151 | exact normalized name |
| 25783 | HÉJJA Boglárka | — | — | 6108: HÉJJA Boglárka; 20116: HÉJJA Boglárka; 23737: HÉJJA Boglárka | flow-6108 | exact normalized name |
| 25789 | KÁRÁNDI Tamás | — | — | 18249: KÁRÁNDI Tamás; 20118: KÁRÁNDI Tamás; 23739: KÁRÁNDI Tamás | flow-18249 | exact normalized name |
| 25791 | KENDERESI Manna | — | — | 17858: KENDERESI Manna; 20120: KENDERESI Manna; 23741: KENDERESI Manna | flow-17858 | exact normalized name |
| 25793 | KRISKÓ András | — | — | 6948: KRISKO Andras; 20122: KRISKÓ András; 23743: KRISKÓ András | flow-6948 | exact normalized name |
| 25799 | PARRAG Szilárd | — | — | 15476: PARRAG Szilárd; 20129: PARRAG Szilárd; 23752: PARRAG Szilárd | flow-15476 | exact normalized name |
| 25800 | PETHŐ Gábor | — | — | 18122: PETHŐ Gábor; 20130: PETHŐ Gábor; 23753: PETHŐ Gábor | flow-18122 | exact normalized name |
| 25805 | RIESING József | — | — | 6756: RIESING József; 20135: RIESING József; 23760: RIESING József | flow-6756 | exact normalized name |
| 25806 | SZABÓ Dávid | — | — | 15480: SZABÓ Dávid; 20136: SZABÓ Dávid; 23761: SZABÓ Dávid | flow-15480 | exact normalized name |
| 25808 | SZABÓ-LÁPOSI Helga | — | — | 6861: SZABÓ-LÁPOSI Helga; 20138: SZABÓ-LÁPOSI Helga; 23763: SZABÓ-LÁPOSI Helga | flow-6861 | exact normalized name |
| 25812 | PINTÉR Nikoleta | — | — | 18491: PINTÉR Nikoleta; 20143: PINTÉR Nikoleta; 23768: PINTÉR Nikoleta | flow-18491 | exact normalized name |
| 25814 | BUBB Tímea | — | — | 18493: BUBB Tímea; 20145: BUBB Tímea; 23771: BUBB Tímea | flow-18493 | exact normalized name |
| 25817 | GAJÁRSZKI Áron | — | — | 18503: GAJÁRSZKI Áron; 20151: GAJÁRSZKI Áron; 23777: GAJÁRSZKI Áron | flow-18503 | exact normalized name |
| 25819 | FARKAS Tamás | — | — | 10269: FARKAS Tamás; 18490: FARKAS Tamás; 20149: FARKAS Tamás | flow-10269 | exact normalized name |
