-- Keep the most recently refreshed case when a growing VL ID group created duplicates.
DELETE FROM collision_cases
WHERE case_key IN (
  SELECT case_key FROM (
    SELECT case_key,
      ROW_NUMBER() OVER (
        PARTITION BY original_flow_id
        ORDER BY updated_at DESC, json_array_length(athlete_ids_json) DESC, case_key
      ) AS position
    FROM collision_cases
  ) WHERE position > 1
);

UPDATE collision_cases SET case_key = 'multi:' || original_flow_id;
CREATE UNIQUE INDEX collision_cases_flow_id ON collision_cases (original_flow_id);
