# Flow Seasons Results

The domain language for presenting results from the Flow Seasons climbing series.

## Language

**Flow Seasons year**:
One annual edition of the Flow Seasons series, comprising four events.
_Avoid_: Season (when referring to the full year; it can be confused with an individual event)

**Athlete**:
A person who competes in Flow Seasons, represented internally by one stable `flow_id`.

**Vertical-Life `athlete_id`**:
The athlete identifier supplied by Vertical-Life and retained unchanged from the source results.

**Flow ID (`flow_id`)**:
A unique Flow identifier for an Athlete; one Athlete may be associated with multiple Vertical-Life `athlete_id` values.

**Athlete ID mapping**:
The current association of a Vertical-Life `athlete_id` with a Flow ID. Changing the association replaces the previous link; it affects Total standings only and does not change source event results.

**Multi-registration**:
A suspected case where one Athlete has multiple Vertical-Life `athlete_id` values after separate registrations. Similar names are a review signal, not proof of identity. See [Multi-registration](docs/multi-registration.md).

**Event**:
One of the four competitions held within a Flow Seasons year.
_Avoid_: Competition (use Event consistently in the results context)

**Finished event**:
An Event whose results are final.
_Avoid_: Completed event

**Active event**:
An event that is in progress and whose results are provisional.

**Category**:
A participant group such as `Hobbi - Férfi`, `Kezdő - Női`, `Nyílt - Férfi`, or `Senior - Női`; Senior is the over-40 group.

**Year category**:
The single category used for an Athlete’s category-specific Total standings for a Flow Seasons year. Source results supply a default, but an explicit admin assignment takes precedence and is confirmed separately for each person after an identity change.

**Pure category change**:
A category conflict where one Athlete appears in multiple Categories during a Flow Seasons year under one unchanged Vertical-Life `athlete_id`. It can be resolved by choosing a Year category without reviewing Athlete ID mappings.

**Identity review**:
The assessment of whether multiple Vertical-Life registrations belong to one Athlete or to different people. Similar names can prompt review whether the registrations are already linked or still separate.

**Registration review case**:
A persistent group of potentially related Vertical-Life registrations, retained through merges and splits. Membership is a review aid, not proof that the registrations belong to one person.

**Keep separate decision**:
An explicit, revisable admin decision that two Vertical-Life registrations represent different people. Repeated candidate detection does not by itself revoke that decision.

**Assignment mismatch**:
A Year category that does not occur in an Athlete’s current ranked source results. It is a review signal, not necessarily an error, because an intentional admin assignment may differ from source categories.

**Overlapping event**:
An Event with more than one ranked entry within a Registration review case, including entries currently assigned to different people. Merging those entries would create a Same-event collision.

**Same-event collision**:
A Flow ID with more than one ranked source entry in the same Event. It must be resolved by an admin; the system must not silently choose or sum the colliding entries.

**Risky merge**:
A Multi-registration that has a Same-event collision, has at least a twofold difference between positive scores recorded under different Vertical-Life `athlete_id` values, or currently affects the top 10 of its Year category.

**Collision resolution**:
The current, revisable admin decision about who owns the registrations in an Identity review and which result counts for any Same-event collision. Each resulting person has a separately confirmed Year category.

**Everyone standings**:
A combined ranking that includes participants from every category.

**Total standings**:
The interim ranking for a Flow Seasons year, using current Athlete ID mappings and Year categories. It sums all available Event scores until the fourth Event is published, then uses each Athlete’s best three Event scores. An unresolved Same-event collision contributes no score for that Athlete from the affected Event. It is provisional while any published Event is active and final when all four Events are finished.
_Avoid_: Overall ranking (unless explicitly qualified as the year’s Total standings)
