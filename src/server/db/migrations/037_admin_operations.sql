ALTER TABLE audit_log ADD COLUMN reason text;
-- Runtime business rules and emergency switches. A missing key means the coded default.
CREATE TABLE platform_settings (
 key text PRIMARY KEY, value jsonb NOT NULL,
 updated_by text REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
-- Account-wide suspension, separate from a business profile's marketplace suspension.
ALTER TABLE users ADD COLUMN suspended_at timestamptz;
ALTER TABLE users ADD COLUMN suspension_reason text;
CREATE TABLE admin_notes (
 id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), author_id text NOT NULL REFERENCES users(id),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_notes_user ON admin_notes(user_id,created_at);
