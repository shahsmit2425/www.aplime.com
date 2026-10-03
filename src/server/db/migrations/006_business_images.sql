CREATE TABLE business_images (
 id uuid PRIMARY KEY, profile_id text NOT NULL REFERENCES profiles(id),
 slot text NOT NULL CHECK(slot IN ('logo','cover','work-1','work-2','work-3','work-4','work-5')),
 object_key text NOT NULL UNIQUE, name text NOT NULL, content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 size integer NOT NULL CHECK(size BETWEEN 1 AND 10485760), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(profile_id,slot,status)
);
