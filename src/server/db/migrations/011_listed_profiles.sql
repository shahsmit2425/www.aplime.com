-- A listed business stays publicly visible while edits to it await re-review.
-- Admin approval sets listed; rejecting or requesting changes clears it.
ALTER TABLE profiles ADD COLUMN listed boolean NOT NULL DEFAULT false;
UPDATE profiles SET listed=true WHERE review_status='approved';
