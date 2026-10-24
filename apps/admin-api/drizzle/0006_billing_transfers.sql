ALTER TYPE "public"."invoice_status" ADD VALUE 'void';--> statement-breakpoint
CREATE SEQUENCE "public"."invoice_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"reference" text,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "discount_percent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_recorded_by_platform_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_platform_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_tenant_idx" ON "invoices" USING btree ("tenant_id","issued_at");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status","due_at");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_number_unique" UNIQUE("number");