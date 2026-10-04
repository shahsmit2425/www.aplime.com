ALTER TABLE profiles ADD COLUMN address text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN place_id text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN service_categories jsonb NOT NULL DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN weekly_hours jsonb NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN time_zone text NOT NULL DEFAULT 'America/New_York';
UPDATE profiles SET service_categories=jsonb_build_array(category);
-- Existing day preferences do not establish consent to specific working hours.
-- Professionals publish actual hours in Calendar & preferences.
ALTER TABLE profiles ADD CONSTRAINT profiles_service_categories_array CHECK(jsonb_typeof(service_categories)='array');
ALTER TABLE profiles ADD CONSTRAINT profiles_weekly_hours_object CHECK(jsonb_typeof(weekly_hours)='object');
CREATE INDEX profiles_service_categories_gin ON profiles USING gin(service_categories);
ALTER TABLE projects ADD COLUMN address text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN place_id text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN address_unit text NOT NULL DEFAULT '';

