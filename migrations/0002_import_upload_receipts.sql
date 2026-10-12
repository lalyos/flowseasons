CREATE TABLE upload_receipts (
  source_key TEXT NOT NULL,
  source_etag TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
  rejection_reason TEXT,
  processed_at TEXT NOT NULL,
  PRIMARY KEY (source_key, source_etag)
);

CREATE UNIQUE INDEX imports_r2_key ON imports (r2_key);
