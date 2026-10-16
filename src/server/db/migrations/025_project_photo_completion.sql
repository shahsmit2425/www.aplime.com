ALTER TABLE uploads ADD COLUMN source_size integer CHECK(source_size>0);
ALTER TABLE uploads ADD COLUMN source_hash text;
ALTER TABLE uploads ADD COLUMN content_received_at timestamptz;
ALTER TABLE uploads ADD COLUMN client_key uuid;
CREATE UNIQUE INDEX uploads_photo_retry ON uploads(project_id,user_id,client_key) WHERE client_key IS NOT NULL;
-- Do not infer receipt/sanitization for historical pending objects.
-- Their owner can safely re-upload through the sanitizing content endpoint.
