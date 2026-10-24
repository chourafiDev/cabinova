CREATE TYPE "public"."feature_level" AS ENUM('included', 'limited', 'addon', 'custom', 'none');--> statement-breakpoint
CREATE TYPE "public"."feature_status" AS ENUM('active', 'beta', 'disabled');--> statement-breakpoint
CREATE TABLE "features" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"status" "feature_status" DEFAULT 'active' NOT NULL,
	"disabled_reason" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_feature_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"feature_key" text NOT NULL,
	"level" "feature_level" NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_feature_overrides" ADD CONSTRAINT "tenant_feature_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_feature_overrides" ADD CONSTRAINT "tenant_feature_overrides_feature_key_features_key_fk" FOREIGN KEY ("feature_key") REFERENCES "public"."features"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tenant_feature_overrides" ADD CONSTRAINT "tenant_feature_overrides_created_by_platform_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_feature_overrides_unique_idx" ON "tenant_feature_overrides" USING btree ("tenant_id","feature_key");--> statement-breakpoint
CREATE INDEX "tenant_feature_overrides_feature_idx" ON "tenant_feature_overrides" USING btree ("feature_key");