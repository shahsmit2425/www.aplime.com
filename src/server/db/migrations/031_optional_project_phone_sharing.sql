-- Existing rows have affirmative consent. Future writes must explicitly opt in.
ALTER TABLE project_contacts ALTER COLUMN consent_at DROP NOT NULL,
  ALTER COLUMN consent_at DROP DEFAULT;
