ALTER TABLE projects ADD COLUMN completion_requested boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN proposed_at timestamptz;
ALTER TABLE projects ADD COLUMN proposed_by text REFERENCES users(id);
CREATE TABLE project_discussions (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id), pro_id text NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,pro_id)
);
CREATE TABLE discussion_messages (
 id uuid PRIMARY KEY, discussion_id uuid NOT NULL REFERENCES project_discussions(id), sender_id text NOT NULL REFERENCES users(id),
 body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX discussion_messages_thread ON discussion_messages(discussion_id,created_at);
ALTER TABLE quotes ADD COLUMN revision integer NOT NULL DEFAULT 1;

-- Keep existing conversations available in the unified inbox.
INSERT INTO project_discussions(id,project_id,pro_id)
SELECT id,id,pro_id FROM projects WHERE pro_id IS NOT NULL;
INSERT INTO discussion_messages(id,discussion_id,sender_id,body,created_at)
SELECT m.id,d.id,m.sender_id,m.body,m.created_at FROM messages m JOIN project_discussions d ON d.project_id=m.project_id;

INSERT INTO project_discussions(id,project_id,pro_id)
SELECT id,project_id,pro_id FROM quotes ON CONFLICT(project_id,pro_id) DO NOTHING;
