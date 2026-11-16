-- Diagnostic becomes rich text (HTML), like motif and examen: the plain
-- notes written so far are escaped and kept line by line.
UPDATE "consultations" SET "diagnosis" = '<p>' || replace(replace(replace(replace("diagnosis", '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\n', '</p><p>') || '</p>'
 WHERE "diagnosis" IS NOT NULL;
