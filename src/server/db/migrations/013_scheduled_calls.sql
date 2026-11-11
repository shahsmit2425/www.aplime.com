CREATE TABLE scheduled_calls (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES users(id),
  pro_id text NOT NULL REFERENCES profiles(id),
  starts_at timestamptz NOT NULL,
  mode text NOT NULL CHECK (mode IN ('audio','video')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','declined','cancelled','completed')),
  proposed_at timestamptz,
  proposed_by text REFERENCES users(id),
  version integer NOT NULL DEFAULT 1,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_id <> pro_id),
  CHECK ((proposed_at IS NULL) = (proposed_by IS NULL)),
  CHECK (proposed_by IS NULL OR proposed_by IN (customer_id,pro_id))
);
CREATE INDEX scheduled_calls_pro_time ON scheduled_calls(pro_id,starts_at) WHERE status='confirmed';
CREATE INDEX scheduled_calls_customer_time ON scheduled_calls(customer_id,starts_at) WHERE status='confirmed';
CREATE INDEX scheduled_calls_project ON scheduled_calls(project_id,created_at DESC);
-- Closing a project or selecting a different professional also closes its calls.
-- These notifications use the existing transactional realtime/mail outbox path.
CREATE FUNCTION close_project_calls() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m scheduled_calls%ROWTYPE;
BEGIN
  FOR m IN UPDATE scheduled_calls SET status='cancelled',proposed_at=NULL,proposed_by=NULL,
    note='The project closed or another professional was selected.',version=version+1,updated_at=now()
    WHERE project_id=NEW.id AND status IN ('requested','confirmed')
      AND (NEW.status IN ('cancelled','completed') OR (NEW.pro_id IS NOT NULL AND pro_id<>NEW.pro_id))
    RETURNING *
  LOOP
    INSERT INTO notifications(id,user_id,title,body,target_page,target_id)
      SELECT gen_random_uuid(),u,'Call meeting cancelled',NEW.title||': the project closed or another professional was selected.','schedule',m.id::text
      FROM unnest(ARRAY[m.customer_id,m.pro_id]) u;
    INSERT INTO email_outbox(id,user_id,subject,body)
      SELECT gen_random_uuid(),id,'Call meeting cancelled',NEW.title||': the project closed or another professional was selected.'
      FROM users WHERE id=ANY(ARRAY[m.customer_id,m.pro_id]) AND COALESCE((settings->>'emailAlerts')::boolean,true);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER project_calls_closed AFTER UPDATE OF status,pro_id ON projects
  FOR EACH ROW EXECUTE FUNCTION close_project_calls();
