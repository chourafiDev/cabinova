ALTER TABLE "medical_profiles" ADD COLUMN "antecedents" text;--> statement-breakpoint
-- Motif and examen become rich text (HTML): the plain notes written so far
-- are escaped and kept line by line, so they read the same in the editor.
UPDATE "consultations" SET "complaint" = '<p>' || replace(replace(replace(replace("complaint", '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\n', '</p><p>') || '</p>'
 WHERE "complaint" IS NOT NULL;--> statement-breakpoint
UPDATE "consultations" SET "examination" = '<p>' || replace(replace(replace(replace("examination", '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\n', '</p><p>') || '</p>'
 WHERE "examination" IS NOT NULL;
