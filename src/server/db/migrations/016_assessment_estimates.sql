-- Keep historical priced estimates intact. Assessment requests have no monetary value.
ALTER TABLE quotes ADD COLUMN assessment_required boolean NOT NULL DEFAULT false;
ALTER TABLE quotes ADD COLUMN estimated_days integer CHECK(estimated_days BETWEEN 1 AND 3650);
ALTER TABLE quotes ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE quotes ADD CONSTRAINT quotes_assessment_pricing_check CHECK (
 (assessment_required AND amount IS NULL AND labor_amount=0 AND materials_amount=0 AND estimated_days IS NULL AND expires_at IS NULL AND status <> 'accepted')
 OR (NOT assessment_required AND amount IS NOT NULL AND amount > 0)
);
