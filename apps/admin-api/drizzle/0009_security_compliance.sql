CREATE TABLE "platform_mfa_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"remember" boolean DEFAULT true NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_mfa_challenges_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tenant_data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requested_by" uuid,
	"sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"tables" jsonb NOT NULL,
	"schema_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_users" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "platform_users" ADD COLUMN "totp_key_version" integer;--> statement-breakpoint
ALTER TABLE "platform_users" ADD COLUMN "totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_users" ADD COLUMN "totp_last_step" integer;--> statement-breakpoint
ALTER TABLE "platform_users" ADD COLUMN "recovery_code_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_databases" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_mfa_challenges" ADD CONSTRAINT "platform_mfa_challenges_user_id_platform_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_data_exports" ADD CONSTRAINT "tenant_data_exports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_data_exports" ADD CONSTRAINT "tenant_data_exports_requested_by_platform_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_mfa_challenges_user_idx" ON "platform_mfa_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_data_exports_tenant_idx" ON "tenant_data_exports" USING btree ("tenant_id","created_at");