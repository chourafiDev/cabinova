ALTER TABLE "appointments" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
-- Visits finished before: their last change is the closest we know.
UPDATE "appointments" SET "completed_at" = "updated_at" WHERE "status" = 'completed';