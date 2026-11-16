CREATE TYPE "public"."letter_kind" AS ENUM('letter', 'report');--> statement-breakpoint
DROP INDEX "letters_patient_idx";--> statement-breakpoint
ALTER TABLE "letters" ADD COLUMN "kind" "letter_kind" DEFAULT 'letter' NOT NULL;--> statement-breakpoint
CREATE INDEX "letters_patient_idx" ON "letters" USING btree ("patient_id","kind");