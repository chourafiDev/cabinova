-- Global search (Super Admin header) ignores accents: "fes" finds "Fès",
-- "medecine" finds "Médecine". Neon ships the extension.
CREATE EXTENSION IF NOT EXISTS unaccent;
