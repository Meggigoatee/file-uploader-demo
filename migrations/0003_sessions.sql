CREATE TABLE anonymous_sessions (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=64),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE session_extension_policies (
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
  extension TEXT NOT NULL CHECK(length(extension) BETWEEN 1 AND 20 AND extension NOT GLOB '*[^a-z0-9]*'),
  kind TEXT NOT NULL CHECK(kind IN ('fixed','custom')),
  blocked INTEGER NOT NULL CHECK(blocked IN (0,1) AND (kind='fixed' OR blocked=1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(session_id,extension),
  CHECK((extension IN ('bat','cmd','com','cpl','exe','scr','js') AND kind='fixed') OR
        (extension NOT IN ('bat','cmd','com','cpl','exe','scr','js') AND kind='custom'))
);
