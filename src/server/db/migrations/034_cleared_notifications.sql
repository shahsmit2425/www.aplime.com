-- When a member cleared a notification from their list. Rows are kept: delivery, alert de-duplication and recipient lookups still read them.
ALTER TABLE notifications ADD COLUMN cleared_at timestamptz;
