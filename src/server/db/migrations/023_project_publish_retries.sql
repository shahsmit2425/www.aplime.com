CREATE TABLE project_publish_requests (
  user_id text NOT NULL REFERENCES users(id),
  client_key uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id),
  fingerprint text NOT NULL,
  PRIMARY KEY(user_id, client_key)
);
