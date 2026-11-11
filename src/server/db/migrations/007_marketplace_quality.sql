ALTER TABLE profiles ADD COLUMN service_radius_miles integer NOT NULL DEFAULT 25 CHECK(service_radius_miles BETWEEN 1 AND 100);
ALTER TABLE profiles ADD COLUMN latitude double precision;
ALTER TABLE profiles ADD COLUMN longitude double precision;
ALTER TABLE profiles ADD COLUMN review_status text NOT NULL DEFAULT 'draft' CHECK(review_status IN ('draft','pending','changes_requested','approved','rejected'));
ALTER TABLE profiles ADD COLUMN review_note text;
ALTER TABLE profiles ADD COLUMN submitted_at timestamptz;
ALTER TABLE profiles ADD COLUMN reviewed_at timestamptz;
ALTER TABLE profiles ADD COLUMN reviewed_by text REFERENCES users(id);

-- Preserve existing verified listings when this workflow is introduced.
UPDATE profiles SET review_status='approved',reviewed_at=now() WHERE verified;

ALTER TABLE projects ADD COLUMN urgency text NOT NULL DEFAULT 'flexible' CHECK(urgency IN ('urgent','this_week','this_month','flexible'));
ALTER TABLE projects ADD COLUMN property_type text NOT NULL DEFAULT 'home' CHECK(property_type IN ('home','apartment','condo','commercial','other'));
ALTER TABLE projects ADD COLUMN budget_min integer CHECK(budget_min IS NULL OR budget_min >= 0);
ALTER TABLE projects ADD COLUMN budget_max integer CHECK(budget_max IS NULL OR budget_max >= 0);
ALTER TABLE projects ADD COLUMN latitude double precision;
ALTER TABLE projects ADD COLUMN longitude double precision;

ALTER TABLE quotes ADD COLUMN labor_amount integer NOT NULL DEFAULT 0 CHECK(labor_amount >= 0);
ALTER TABLE quotes ADD COLUMN materials_amount integer NOT NULL DEFAULT 0 CHECK(materials_amount >= 0);
ALTER TABLE quotes ADD COLUMN exclusions text NOT NULL DEFAULT '';
ALTER TABLE quotes ADD COLUMN timeline text NOT NULL DEFAULT '';
ALTER TABLE quotes ADD COLUMN expires_at timestamptz;
UPDATE quotes SET labor_amount=amount WHERE labor_amount=0 AND materials_amount=0;

CREATE TABLE project_drafts (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 payload jsonb NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_marketplace_match ON profiles(category,review_status,available,suspended);
CREATE INDEX projects_open_match ON projects(category,status,created_at);
