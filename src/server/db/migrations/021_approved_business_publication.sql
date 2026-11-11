ALTER TABLE profiles ADD COLUMN published_profile jsonb;
CREATE TABLE storage_cleanup_jobs (object_key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now());
