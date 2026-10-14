-- Deleted accounts keep their row (anonymised) so shared project, payment and
-- audit records stay consistent for the other participants.
ALTER TABLE users ADD COLUMN deleted_at timestamptz;
