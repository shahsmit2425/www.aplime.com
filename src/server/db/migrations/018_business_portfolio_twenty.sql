-- Preserve existing branding/work images while expanding the portfolio to 20.
ALTER TABLE business_images DROP CONSTRAINT business_images_slot_check;
ALTER TABLE business_images ADD CONSTRAINT business_images_slot_check CHECK (
 slot IN ('logo','cover') OR slot ~ '^work-([1-9]|1[0-9]|20)$'
);
