ALTER TABLE "clinic_settings" ADD COLUMN "hours_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN "checklist_dismissed_at" timestamp with time zone;--> statement-breakpoint
-- Cabinets already at work have settled their hours.
UPDATE "clinic_settings" SET "hours_confirmed_at" = now()
 WHERE EXISTS (SELECT 1 FROM "appointments")
    OR EXISTS (
      SELECT 1 FROM "spaces"
       WHERE "opening_hours" <> '{"0":[],"1":[{"from":"08:00","to":"18:00"}],"2":[{"from":"08:00","to":"18:00"}],"3":[{"from":"08:00","to":"18:00"}],"4":[{"from":"08:00","to":"18:00"}],"5":[{"from":"08:00","to":"18:00"}],"6":[{"from":"08:00","to":"13:00"}]}'::jsonb
    );
