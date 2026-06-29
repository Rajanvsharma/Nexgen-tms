-- Add phone field to User model (was in schema but never migrated)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
