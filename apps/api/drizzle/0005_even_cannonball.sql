CREATE TYPE "public"."blood_group" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');--> statement-breakpoint
CREATE TYPE "public"."consultation_status" AS ENUM('draft', 'completed');--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"appointment_id" uuid,
	"status" "consultation_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"history" text,
	"examination" text,
	"diagnosis" text,
	"plan" text,
	"weight_kg" real,
	"height_cm" real,
	"temperature_c" real,
	"systolic" integer,
	"diastolic" integer,
	"heart_rate" integer,
	"spo2" integer,
	"glycemia" real,
	"completed_at" timestamp with time zone,
	"completed_by_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medical_profiles" (
	"patient_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"blood_group" "blood_group",
	"allergies" text,
	"chronic_conditions" text,
	"medical_history" text,
	"surgical_history" text,
	"family_history" text,
	"current_treatments" text,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medical_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_practitioner_id_users_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consultations_appointment_idx" ON "consultations" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "consultations_tenant_started_idx" ON "consultations" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX "consultations_patient_idx" ON "consultations" USING btree ("patient_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "consultations" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "medical_profiles" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);