CREATE TYPE "public"."tenant_status_change_state" AS ENUM('scheduled', 'applied', 'cancelled', 'failed');--> statement-breakpoint
CREATE TABLE "tenant_status_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_status" "tenant_status" NOT NULL,
	"to_status" "tenant_status" NOT NULL,
	"reason" text,
	"comment" text,
	"effective_at" timestamp with time zone NOT NULL,
	"state" "tenant_status_change_state" NOT NULL,
	"applied_at" timestamp with time zone,
	"failure_reason" text,
	"notify_responsible" boolean DEFAULT true NOT NULL,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_status_changes" ADD CONSTRAINT "tenant_status_changes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_status_changes" ADD CONSTRAINT "tenant_status_changes_requested_by_platform_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_status_changes_tenant_idx" ON "tenant_status_changes" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "tenant_status_changes_due_idx" ON "tenant_status_changes" USING btree ("effective_at") WHERE "tenant_status_changes"."state" = 'scheduled';--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_status_changes_one_scheduled_idx" ON "tenant_status_changes" USING btree ("tenant_id") WHERE "tenant_status_changes"."state" = 'scheduled';--> statement-breakpoint
CREATE INDEX "platform_audit_logs_tenant_idx" ON "platform_audit_logs" USING btree ("tenant_id","created_at");