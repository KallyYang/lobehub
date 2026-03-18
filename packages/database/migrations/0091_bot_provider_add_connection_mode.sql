DROP INDEX IF EXISTS "agent_bot_providers_platform_app_id_unique";--> statement-breakpoint
ALTER TABLE "agent_bot_providers" ADD COLUMN IF NOT EXISTS "connection_mode" varchar(20) DEFAULT 'webhook' NOT NULL;--> statement-breakpoint
UPDATE "agent_bot_providers" SET "connection_mode" = 'websocket' WHERE "platform" = 'discord' AND "connection_mode" = 'webhook';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_bot_providers_platform_conn_app_id_unique" ON "agent_bot_providers" USING btree ("platform","connection_mode","application_id");