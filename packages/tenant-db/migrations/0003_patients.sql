CREATE TYPE "public"."blood_group" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');--> statement-breakpoint
CREATE TYPE "public"."coverage" AS ENUM('none', 'cnss', 'cnops', 'amo_tadamon', 'far', 'private');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TABLE "medical_profiles" (
	"patient_id" uuid PRIMARY KEY NOT NULL,
	"blood_group" "blood_group",
	"allergies" text,
	"chronic_conditions" text,
	"medical_history" text,
	"surgical_history" text,
	"family_history" text,
	"current_treatments" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "patients_file_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"sex" "sex" NOT NULL,
	"birth_date" date,
	"cin" text,
	"phone" text,
	"email" text,
	"address" text,
	"city" text,
	"coverage" "coverage" DEFAULT 'none' NOT NULL,
	"coverage_number" text,
	"insurer" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_file_number_unique" UNIQUE("file_number")
);
--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "patients_cin_idx" ON "patients" USING btree ("cin") WHERE "patients"."cin" is not null;--> statement-breakpoint
CREATE INDEX "patients_name_idx" ON "patients" USING btree ("last_name","first_name");--> statement-breakpoint
-- Patient search ignores accents ("benjelloun" finds "Benjélloun"). Trusted
-- extension: the cabinet's own role (database owner) may create it.
CREATE EXTENSION IF NOT EXISTS unaccent;
