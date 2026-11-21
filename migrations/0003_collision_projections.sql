CREATE TABLE collision_cases (
  case_key TEXT PRIMARY KEY,
  original_flow_id TEXT NOT NULL,
  athlete_ids_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  reasons_json TEXT NOT NULL,
  resolution_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE event_result_choices (
  import_id INTEGER NOT NULL REFERENCES imports (import_id),
  flow_id TEXT NOT NULL,
  entry_id INTEGER NOT NULL REFERENCES event_results (entry_id),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (import_id, flow_id)
);
