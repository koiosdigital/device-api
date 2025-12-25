-- Add column to store which user has claimed a device
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "claimed_by_user_id" TEXT;

-- Index speeds up lookups by owner/claim status
CREATE INDEX IF NOT EXISTS "Device_claimed_by_user_id_idx" ON "Device" ("claimed_by_user_id");
