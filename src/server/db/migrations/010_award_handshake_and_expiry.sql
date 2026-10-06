ALTER TABLE projects ADD COLUMN award_accepted boolean NOT NULL DEFAULT true;
ALTER TABLE quotes DROP CONSTRAINT quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check CHECK(status IN ('pending','accepted','declined','withdrawn','expired'));
CREATE INDEX quotes_pending_expiry ON quotes(expires_at) WHERE status='pending' AND expires_at IS NOT NULL;
CREATE INDEX email_outbox_due ON email_outbox(next_attempt_at) WHERE sent_at IS NULL;
