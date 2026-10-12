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
An admin decision associating a Vertical-Life `athlete_id` with a Flow ID. Each change is recorded separately; changes affect Total standings, not the original event results.

**Event**:
One of the four competitions held within a Flow Seasons year.
_Avoid_: Competition (use Event consistently in the results context)

**Active event**:
An event that is in progress and whose results are provisional.

**Category**:
A participant group such as `Hobbi - Férfi`, `Kezdő - Női`, `Nyílt - Férfi`, or `Senior - Női`.

**Year category**:
The single category an Athlete is assigned to for a whole Flow Seasons year by an admin. It affects category-specific Total standings only.

**Everyone standings**:
A combined ranking that includes participants from every category.

**Total standings**:
The interim ranking for a Flow Seasons year, ordered by each Athlete’s summed `score` from finished events to date, using current Athlete ID mappings and year categories; it becomes final when all four events are finished.
_Avoid_: Overall ranking (unless explicitly qualified as the year’s Total standings)
