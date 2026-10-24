ALTER TABLE "subscription_plans" ALTER COLUMN "features" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "max_secretaries" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "storage_quota_mb" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_live_idx" ON "subscriptions" USING btree ("tenant_id") WHERE "subscriptions"."status" <> 'cancelled';