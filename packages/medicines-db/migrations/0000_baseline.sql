-- Trigram search (autocomplete) on the brand and the substances.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."medication_availability" AS ENUM('marketed', 'not_marketed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."medication_import_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "medication_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"status" "medication_import_status" DEFAULT 'running' NOT NULL,
	"rows_read" integer DEFAULT 0 NOT NULL,
	"rows_inserted" integer DEFAULT 0 NOT NULL,
	"rows_updated" integer DEFAULT 0 NOT NULL,
	"rows_deactivated" integer DEFAULT 0 NOT NULL,
	"error" text,
	"imported_by" uuid,
	"imported_by_name" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"ammps_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"substances" text NOT NULL,
	"dosage" text,
	"form" text,
	"presentation" text,
	"lab" text,
	"status" text,
	"availability" "medication_availability" NOT NULL,
	"ppv" numeric(10, 2),
	"ph" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"import_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "medication_imports_one_running_idx" ON "medication_imports" USING btree ("status") WHERE "medication_imports"."status" = 'running';--> statement-breakpoint
CREATE INDEX "medication_imports_started_idx" ON "medication_imports" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "medications_name_trgm_idx" ON "medications" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "medications_substances_trgm_idx" ON "medications" USING gin ("substances" gin_trgm_ops);