-- Town/state are resolved by the server from Google, never accepted from project payloads.
ALTER TABLE projects ADD COLUMN town text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN region text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN town text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN region text NOT NULL DEFAULT '';
-- Only backfill clearly formatted, previously resolved US addresses. No ZIP-to-town guesses.
UPDATE projects SET town=btrim((regexp_match(address, ',\s*([^,]+),\s*([A-Z]{2})\s+[0-9]{5}(-[0-9]{4})?(,\s*(USA|United States))?$'))[1]),
 region=(regexp_match(address, ',\s*([^,]+),\s*([A-Z]{2})\s+[0-9]{5}(-[0-9]{4})?(,\s*(USA|United States))?$'))[2]
 WHERE place_id<>'' AND address ~ ',\s*[^,]+,\s*[A-Z]{2}\s+[0-9]{5}(-[0-9]{4})?(,\s*(USA|United States))?$';
UPDATE profiles SET town=btrim((regexp_match(address, ',\s*([^,]+),\s*([A-Z]{2})\s+[0-9]{5}(-[0-9]{4})?(,\s*(USA|United States))?$'))[1]),
 region=(regexp_match(address, ',\s*([^,]+),\s*([A-Z]{2})\s+[0-9]{5}(-[0-9]{4})?(,\s*(USA|United States))?$'))[2]
 WHERE place_id<>'' AND address ~ ',\s*[^,]+,\s*[A-Z]{2}\s+[0-9]{5}(-[0-9]{4})?(,\s*(USA|United States))?$';
CREATE INDEX profiles_public_locality ON profiles(region,town) WHERE verified AND NOT suspended;
