CREATE TYPE "public"."tenant_status" AS ENUM('trial', 'active', 'suspended', 'archived');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"custom_domain" text,
	"status" "tenant_status" DEFAULT 'trial' NOT NULL,
	"country" text DEFAULT 'MA' NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"timezone" text DEFAULT 'Africa/Casablanca' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_custom_domain_unique" UNIQUE("custom_domain")
);
