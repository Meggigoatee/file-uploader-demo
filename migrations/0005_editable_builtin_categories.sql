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
