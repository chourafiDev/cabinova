ALTER TABLE "acts" ADD COLUMN "color" text DEFAULT 'blue' NOT NULL;--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_color_known" CHECK ("acts"."color" in ('blue', 'green', 'purple', 'orange', 'amber', 'yellow', 'red', 'brand', 'gray'));--> statement-breakpoint
-- Existing acts take the palette in turn (by name), so the agenda isn't all blue.
UPDATE "acts" SET "color" = (ARRAY['blue', 'green', 'purple', 'orange', 'amber', 'yellow', 'red', 'brand'])[(o.n - 1) % 8 + 1]
  FROM (SELECT "id", row_number() OVER (ORDER BY lower("name")) AS n FROM "acts") o
 WHERE o."id" = "acts"."id";
