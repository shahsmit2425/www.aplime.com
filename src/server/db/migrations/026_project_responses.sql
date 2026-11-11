CREATE TABLE project_responses (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pro_id text NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('interested','needs_details','unavailable')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, pro_id)
);
CREATE INDEX project_responses_pro ON project_responses(pro_id);
CREATE TABLE project_outreach (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pro_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, pro_id)
);
ALTER TABLE projects ADD COLUMN award_selected_at timestamptz;
ALTER TABLE projects ADD COLUMN outreach_checked_at timestamptz;
