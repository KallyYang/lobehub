-- Add settings jsonb column to store user-configurable settings
-- (dm policy, charLimit, debounce, etc.)
ALTER TABLE "agent_bot_providers" ADD COLUMN IF NOT EXISTS "settings" jsonb DEFAULT '{}';
