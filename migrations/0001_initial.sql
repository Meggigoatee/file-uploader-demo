CREATE TABLE IF NOT EXISTS extension_policies (
  extension TEXT PRIMARY KEY NOT NULL CHECK(length(extension) BETWEEN 1 AND 20 AND extension NOT GLOB '*[^a-z0-9]*'),
  kind TEXT NOT NULL CHECK(kind IN ('fixed','custom')),
  blocked INTEGER NOT NULL CHECK(blocked IN (0,1) AND (kind='fixed' OR blocked=1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK((extension IN ('bat','cmd','com','cpl','exe','scr','js') AND kind='fixed') OR
        (extension NOT IN ('bat','cmd','com','cpl','exe','scr','js') AND kind='custom'))
);
INSERT OR IGNORE INTO extension_policies(extension,kind,blocked) VALUES
('bat','fixed',0),('cmd','fixed',0),('com','fixed',0),('cpl','fixed',0),('exe','fixed',0),('scr','fixed',0),('js','fixed',0);
