CREATE TABLE account_cleanup_jobs (
 user_id text PRIMARY KEY REFERENCES users(id), object_keys jsonb NOT NULL,
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX account_cleanup_due ON account_cleanup_jobs(next_attempt_at) WHERE completed_at IS NULL;
ALTER TABLE discussion_messages ADD COLUMN client_key uuid;
CREATE UNIQUE INDEX discussion_message_retry ON discussion_messages(discussion_id,sender_id,client_key) WHERE client_key IS NOT NULL;
