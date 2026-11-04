CREATE TABLE "phrases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"field" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "consultation_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "glycemia_postprandial" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "hba1c" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "next_visit_note" text;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD COLUMN "toxic_habits" text;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD COLUMN "gyneco_history" text;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD COLUMN "risk_factors" text;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD COLUMN "permanent_note" text;--> statement-breakpoint
ALTER TABLE "phrases" ADD CONSTRAINT "phrases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phrases_user_field_idx" ON "phrases" USING btree ("user_id","field");