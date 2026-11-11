ALTER TABLE notifications ADD COLUMN target_page text NOT NULL DEFAULT 'notifications';
ALTER TABLE notifications ADD COLUMN target_id text;
CREATE INDEX notifications_unread_user ON notifications(user_id) WHERE NOT read;
CREATE OR REPLACE FUNCTION broadcast_notification_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('aplime_notifications', NEW.user_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER notifications_changed AFTER INSERT OR UPDATE OF read ON notifications
FOR EACH ROW EXECUTE FUNCTION broadcast_notification_change();
