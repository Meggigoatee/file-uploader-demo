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
