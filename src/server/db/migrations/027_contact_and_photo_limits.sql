ALTER TABLE business_images DROP CONSTRAINT business_images_slot_check;
ALTER TABLE business_images ADD CONSTRAINT business_images_slot_check CHECK(slot IN ('logo','cover') OR slot ~ '^work-([1-9]|[12][0-9]|30)$');
-- Contact details stay out of public project/lead projections.
CREATE TABLE project_contacts (
 project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
 phone text NOT NULL CHECK(phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'),
 consent_at timestamptz NOT NULL DEFAULT now(),
 consent_version text NOT NULL DEFAULT 'project-contact-v1'
);
CREATE TABLE review_images (
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 slot integer NOT NULL CHECK(slot BETWEEN 1 AND 10),
 object_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,slot)
);
