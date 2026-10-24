CREATE TYPE "public"."provisioning_run_state" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "tenant_provisioning_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"state" "provisioning_run_state" DEFAULT 'running' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"send_invitation" boolean DEFAULT true NOT NULL,
	"started_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tenant_databases" ADD COLUMN "mode" text DEFAULT 'database' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_databases" ADD COLUMN "role_name" text;--> statement-breakpoint
ALTER TABLE "tenant_databases" ADD COLUMN "last_migration_error" text;--> statement-breakpoint
ALTER TABLE "tenant_databases" ADD COLUMN "last_health_error" text;--> statement-breakpoint
ALTER TABLE "tenant_databases" ADD COLUMN "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "tenant_provisioning_runs" ADD CONSTRAINT "tenant_provisioning_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_provisioning_runs" ADD CONSTRAINT "tenant_provisioning_runs_started_by_platform_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_provisioning_runs_tenant_idx" ON "tenant_provisioning_runs" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_provisioning_runs_one_running_idx" ON "tenant_provisioning_runs" USING btree ("tenant_id") WHERE "tenant_provisioning_runs"."state" = 'running';--> statement-breakpoint
ALTER TABLE "tenant_databases" ADD CONSTRAINT "tenant_databases_secret_ref_tenant_secrets_id_fk" FOREIGN KEY ("secret_ref") REFERENCES "public"."tenant_secrets"("id") ON DELETE restrict ON UPDATE no action;