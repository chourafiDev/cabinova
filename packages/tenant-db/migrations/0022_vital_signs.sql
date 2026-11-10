CREATE TABLE "vital_signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" uuid,
	"weight_kg" numeric(5, 2),
	"height_cm" numeric(4, 1),
	"temperature_c" numeric(3, 1),
	"blood_group" "blood_group",
	"glycemia" numeric(4, 2),
	"glycemia_postprandial" numeric(4, 2),
	"hba1c" numeric(3, 1),
	"bp_right_systolic" smallint,
	"bp_right_diastolic" smallint,
	"bp_left_systolic" smallint,
	"bp_left_diastolic" smallint,
	"heart_rate" smallint,
	"spo2" smallint,
	"waist_cm" numeric(4, 1),
	"head_circumference_cm" numeric(4, 1),
	"abdominal_circumference_cm" numeric(4, 1),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vital_signs_patient_idx" ON "vital_signs" USING btree ("patient_id","measured_at");