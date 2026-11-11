ALTER TABLE email_outbox ADD COLUMN category text;
ALTER TABLE email_outbox ADD COLUMN essential boolean NOT NULL DEFAULT false;
ALTER TABLE email_outbox ADD COLUMN target_page text;
ALTER TABLE email_outbox ADD COLUMN target_id text;
ALTER TABLE email_outbox ADD COLUMN notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL;
ALTER TABLE email_outbox ADD COLUMN cancelled_at timestamptz;
ALTER TABLE email_outbox ADD COLUMN event_key text;
-- A deletion confirmation needs a short-lived address after anonymization.
ALTER TABLE email_outbox ADD COLUMN recipient_email text;
ALTER TABLE professional_subscriptions ADD COLUMN billing_price_id text;
CREATE INDEX email_outbox_pending_messages ON email_outbox(user_id,target_id) WHERE category='messages' AND sent_at IS NULL AND cancelled_at IS NULL AND attempts=0;
CREATE TABLE alert_event_receipts (
 user_id text NOT NULL REFERENCES users(id), event_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,event_key)
);
CREATE TABLE email_category_settings (category text PRIMARY KEY,enabled boolean NOT NULL DEFAULT true);
INSERT INTO email_category_settings(category) VALUES ('projects'),('messages'),('meetings'),('business'),('reviews'),('support');
