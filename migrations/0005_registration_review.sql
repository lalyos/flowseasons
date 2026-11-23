-- Existing category provenance cannot be recovered reliably. Preserve it conservatively.
ALTER TABLE year_categories ADD COLUMN origin TEXT NOT NULL DEFAULT 'legacy'
  CHECK(origin IN ('import', 'admin', 'legacy'));

CREATE TABLE registration_review_cases (
  case_id TEXT PRIMARY KEY,
  athlete_ids_json TEXT NOT NULL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  signature TEXT,
  reviewed_signature TEXT,
  decision_json TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO registration_review_cases
  (case_id, athlete_ids_json, reasons_json, evidence_json, decision_json, updated_at)
SELECT case_key, athlete_ids_json, reasons_json, '[]', resolution_json, updated_at
FROM collision_cases;

CREATE TABLE registration_separations (
  athlete_id_a TEXT NOT NULL,
  athlete_id_b TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (athlete_id_a, athlete_id_b),
  CHECK(athlete_id_a < athlete_id_b)
);

-- Carry explicit legacy split decisions forward so refresh does not undo them.
INSERT OR IGNORE INTO registration_separations (athlete_id_a, athlete_id_b, updated_at)
SELECT MIN(json_extract(c.resolution_json, '$.athlete_id'), CAST(member.value AS TEXT)),
       MAX(json_extract(c.resolution_json, '$.athlete_id'), CAST(member.value AS TEXT)),
       c.updated_at
FROM collision_cases c, json_each(c.athlete_ids_json) member
WHERE json_extract(c.resolution_json, '$.action') = 'split'
  AND CAST(member.value AS TEXT) != json_extract(c.resolution_json, '$.athlete_id');

-- Choices belong to an import snapshot and must disappear when its rows are replaced.
CREATE TRIGGER remove_obsolete_result_choices BEFORE DELETE ON event_results
BEGIN
  DELETE FROM event_result_choices WHERE entry_id = OLD.entry_id;
END;

-- Guard checks run in the same atomic batch as identity writes, rejecting concurrent changes.
CREATE TABLE registration_review_write_guards (
  token TEXT NOT NULL,
  valid INTEGER NOT NULL CHECK(valid = 1)
);

-- Retain collision_cases as a read-only legacy record; the new UI never writes it.
