CREATE TABLE project_contact_reveals (
  pro_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revealed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_contact_reveals_recent ON project_contact_reveals(pro_id, revealed_at);
