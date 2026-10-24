ALTER TABLE "subscriptions" ADD COLUMN "price" integer;--> statement-breakpoint
-- Existing subscriptions keep the price of their plan at the time of this migration.
UPDATE "subscriptions" SET "price" = CASE "subscriptions"."billing_period" WHEN 'annual' THEN p."price_annual" ELSE p."price_monthly" END FROM "subscription_plans" p WHERE p."id" = "subscriptions"."plan_id";--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "price" SET NOT NULL;
