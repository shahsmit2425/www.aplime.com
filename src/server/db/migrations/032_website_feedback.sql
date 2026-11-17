CREATE TABLE website_feedback (
 id uuid PRIMARY KEY,
 category text NOT NULL CHECK (category IN ('suggestion', 'problem', 'other')),
 message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
 email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 254),
 page text NOT NULL,
 reviewed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX website_feedback_created_idx ON website_feedback(created_at DESC);
