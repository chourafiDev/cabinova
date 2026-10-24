CREATE TABLE "clinic_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"specialty" text,
	"address" text,
	"city" text,
	"phone" text,
	"email" text NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"timezone" text DEFAULT 'Africa/Casablanca' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinic_settings_single_row" CHECK ("clinic_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"invite_token_hash" text,
	"invite_expires_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_invite_token_hash_unique" UNIQUE("invite_token_hash")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");