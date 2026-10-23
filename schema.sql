-- Submission schema: migrations 0001 through 0005, concatenated in order.
-- Source of truth: migrations/. Local initialization: pnpm run db:local.
-- Intended for review or an empty database, not reapplication to an existing database.

-- source: migrations/0001_initial.sql
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

-- source: migrations/0002_budget.sql
CREATE TABLE IF NOT EXISTS upload_budget (
  id INTEGER PRIMARY KEY CHECK(id=1),
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
  reserved_puts INTEGER NOT NULL DEFAULT 0 CHECK(reserved_puts>=0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO upload_budget(id) VALUES(1);

-- source: migrations/0003_sessions.sql
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

-- source: migrations/0004_categories.sql
CREATE TABLE custom_categories (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE CHECK(length(name) BETWEEN 1 AND 30),
  UNIQUE(session_id,name)
);
CREATE TABLE category_extensions (
  category_id TEXT NOT NULL REFERENCES custom_categories(id) ON DELETE CASCADE,
  extension TEXT NOT NULL CHECK(length(extension) BETWEEN 1 AND 20 AND extension NOT GLOB '*[^a-z0-9]*'),
  PRIMARY KEY(category_id,extension)
);

-- source: migrations/0005_editable_builtin_categories.sql
ALTER TABLE custom_categories ADD COLUMN builtin_key TEXT CHECK(builtin_key IS NULL OR builtin_key IN ('photos','videos','audio','documents'));
CREATE UNIQUE INDEX category_builtin_per_session ON custom_categories(session_id,builtin_key);
INSERT INTO custom_categories(id,session_id,name,builtin_key)
SELECT s.id || ':' || json_extract(c.value,'$.id'),s.id,json_extract(c.value,'$.name'),json_extract(c.value,'$.id')
FROM anonymous_sessions s,json_each('[{"id":"photos","name":"사진"},{"id":"videos","name":"영상"},{"id":"audio","name":"음성"},{"id":"documents","name":"문서"}]') c;
INSERT INTO category_extensions(category_id,extension)
SELECT c.id,e.value FROM custom_categories c,json_each(CASE c.builtin_key
WHEN 'photos' THEN '["jpg","jpeg","png","webp","gif"]'
WHEN 'videos' THEN '["mp4","webm","mov","avi","mkv"]'
WHEN 'audio' THEN '["mp3","wav","ogg","flac","aac"]'
WHEN 'documents' THEN '["pdf","txt","docx","xlsx","pptx"]' ELSE '[]' END) e;
