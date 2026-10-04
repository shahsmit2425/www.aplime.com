ALTER TABLE projects DROP CONSTRAINT projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK(status IN ('requested','quoted','booked','in_progress','paused','completed','cancelled','disputed'));
ALTER TABLE projects ADD COLUMN paused_from text CHECK(paused_from IN ('requested','quoted','booked','in_progress'));
ALTER TABLE projects ADD COLUMN paused_by text REFERENCES users(id);
ALTER TABLE projects ADD COLUMN pause_reason text;
ALTER TABLE projects ADD COLUMN completion_requested_by text REFERENCES users(id);
UPDATE projects SET completion_requested_by=pro_id WHERE completion_requested;
ALTER TABLE projects ADD COLUMN cancellation_requested_by text REFERENCES users(id);
ALTER TABLE projects ADD COLUMN cancellation_request_id uuid;
ALTER TABLE projects ADD COLUMN cancellation_reason text;
ALTER TABLE projects ADD COLUMN version integer NOT NULL DEFAULT 1;
CREATE TABLE project_archives (
 project_id uuid NOT NULL REFERENCES projects(id), user_id text NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(project_id,user_id)
);
CREATE TABLE project_activity (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
 action text NOT NULL, summary text NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_activity_project ON project_activity(project_id,created_at);
ALTER TABLE quotes DROP CONSTRAINT quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check CHECK(status IN ('pending','accepted','declined','withdrawn'));
