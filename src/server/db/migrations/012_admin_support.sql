ALTER TABLE tickets ADD COLUMN opened_by text REFERENCES users(id);
CREATE TABLE support_messages (
 id uuid PRIMARY KEY, ticket_id uuid NOT NULL REFERENCES tickets(id),
 sender_id text NOT NULL REFERENCES users(id), client_key uuid NOT NULL,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(ticket_id,sender_id,client_key)
);
CREATE INDEX support_messages_thread ON support_messages(ticket_id,created_at,id);
CREATE INDEX tickets_owner_recent ON tickets(user_id,created_at);
CREATE INDEX audit_log_entity_recent ON audit_log(entity_id,created_at);
CREATE TABLE call_events (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id),
 discussion_id uuid REFERENCES project_discussions(id), actor_id text NOT NULL REFERENCES users(id),
 mode text NOT NULL CHECK(mode IN ('audio','video')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_events_project ON call_events(project_id,created_at);
CREATE INDEX discussion_messages_sender ON discussion_messages(sender_id,created_at);
CREATE INDEX support_messages_sender ON support_messages(sender_id,created_at);
CREATE INDEX users_created_at ON users(created_at);
CREATE INDEX projects_created_at ON projects(created_at);
CREATE INDEX discussion_messages_created_at ON discussion_messages(created_at);
