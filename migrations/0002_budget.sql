CREATE TABLE IF NOT EXISTS upload_budget (
  id INTEGER PRIMARY KEY CHECK(id=1),
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
  reserved_puts INTEGER NOT NULL DEFAULT 0 CHECK(reserved_puts>=0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO upload_budget(id) VALUES(1);
