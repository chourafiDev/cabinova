CREATE TABLE "custom_medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"substances" text,
	"dosage" text,
	"form" text,
	"presentation" text,
	"default_posology" text,
	"default_duration" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"ammps_id" integer NOT NULL,
	"custom_name" text,
	"custom_dosage" text,
	"default_posology" text,
	"default_duration" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"base_name" text,
	"base_dosage" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_medications" ADD CONSTRAINT "custom_medications_practitioner_id_users_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_overrides" ADD CONSTRAINT "medication_overrides_practitioner_id_users_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_medications_practitioner_name_idx" ON "custom_medications" USING btree ("practitioner_id",lower("name"),lower(coalesce("dosage", '')));--> statement-breakpoint
CREATE UNIQUE INDEX "medication_overrides_practitioner_ammps_idx" ON "medication_overrides" USING btree ("practitioner_id","ammps_id");