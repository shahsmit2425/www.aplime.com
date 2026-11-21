-- The short public name a customer chose to publish with a review. Earlier reviews stay unnamed.
ALTER TABLE reviews ADD COLUMN reviewer_name text CHECK(reviewer_name IS NULL OR char_length(reviewer_name) BETWEEN 1 AND 40);
ALTER TABLE reviews ADD COLUMN replied_at timestamptz;
