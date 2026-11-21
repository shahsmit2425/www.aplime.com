-- Why an administrator suspended a business profile. Shown to its owner and cleared on restore.
ALTER TABLE profiles ADD COLUMN suspension_note text;
