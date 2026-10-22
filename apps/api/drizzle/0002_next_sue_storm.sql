ALTER TABLE "users" ADD COLUMN "invite_token_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invite_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invite_token_hash_unique" UNIQUE("invite_token_hash");