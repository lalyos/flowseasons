CREATE TABLE events (
  event_pk INTEGER PRIMARY KEY,
  year INTEGER NOT NULL,
  season TEXT NOT NULL CHECK (season IN ('Spring', 'Summer', 'Autumn', 'Winter')),
  current_import_id INTEGER,
  UNIQUE (year, season),
  FOREIGN KEY (event_pk, current_import_id)
    REFERENCES imports (event_pk, import_id)
);

CREATE TABLE imports (
  import_id INTEGER PRIMARY KEY,
  event_pk INTEGER NOT NULL REFERENCES events (event_pk),
  event_id TEXT NOT NULL,
  id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'finished')),
  accepted_at TEXT NOT NULL,
  UNIQUE (event_pk, import_id)
);

CREATE INDEX imports_source_identity ON imports (event_id, id);
CREATE INDEX imports_event_history ON imports (event_pk, accepted_at);

CREATE TABLE event_results (
  entry_id INTEGER PRIMARY KEY,
  import_id INTEGER NOT NULL REFERENCES imports (import_id),
  athlete_id TEXT,
  name TEXT,
  firstname TEXT,
  lastname TEXT,
  rank INTEGER,
  source_category TEXT,
  score_hundredths INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX event_results_import_rank ON event_results (import_id, rank);

CREATE TABLE "athlete-linking" (
  athlete_id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL
);

CREATE TABLE year_categories (
  year INTEGER NOT NULL,
  flow_id TEXT NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (year, flow_id)
);

CREATE TABLE total_standings (
  year INTEGER NOT NULL,
  flow_id TEXT NOT NULL,
  category TEXT NOT NULL,
  score_hundredths INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  PRIMARY KEY (year, flow_id)
);

CREATE INDEX total_standings_year_rank ON total_standings (year, rank);
