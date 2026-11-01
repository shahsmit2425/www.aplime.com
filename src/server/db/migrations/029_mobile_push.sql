CREATE TABLE push_devices (
 token text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 platform text NOT NULL CHECK (platform IN ('ios','android')),
 registered_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_devices_user ON push_devices(user_id);
CREATE TABLE push_deliveries (
 id bigserial PRIMARY KEY,
 notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
 token text NOT NULL REFERENCES push_devices(token) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_error text,
 UNIQUE(notification_id,token)
);
CREATE INDEX push_deliveries_pending ON push_deliveries(next_attempt_at) WHERE status='pending';
CREATE FUNCTION queue_mobile_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO push_deliveries(notification_id,token,user_id)
 SELECT NEW.id,d.token,NEW.user_id FROM push_devices d JOIN users u ON u.id=d.user_id
 WHERE d.user_id=NEW.user_id AND u.deleted_at IS NULL AND u.role <> 'admin'
 AND d.updated_at > now()-interval '60 days';
 RETURN NEW;
END;
$$;
CREATE TRIGGER queue_mobile_push AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION queue_mobile_push();

CREATE FUNCTION revoke_mobile_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
 OR (NEW.sessions_revoked_at IS NOT NULL AND OLD.sessions_revoked_at IS DISTINCT FROM NEW.sessions_revoked_at) THEN
   DELETE FROM push_devices WHERE user_id=NEW.id;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER revoke_mobile_push AFTER UPDATE OF deleted_at,sessions_revoked_at ON users
FOR EACH ROW EXECUTE FUNCTION revoke_mobile_push();
