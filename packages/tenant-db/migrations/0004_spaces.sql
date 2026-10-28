CREATE TABLE "space_members" (
	"space_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_members_space_id_user_id_pk" PRIMARY KEY("space_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"address" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "patients_cin_idx";--> statement-breakpoint
DROP INDEX "patients_name_idx";--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "space_id" uuid;--> statement-breakpoint
-- Every cabinet has at least one space: existing patients and staff move
-- into "Espace principal" (address from the clinic profile when known;
-- provisioning fills it for new cabinets).
INSERT INTO "spaces" ("name", "city", "address", "phone")
SELECT 'Espace principal', cs."city", cs."address", cs."phone"
FROM (SELECT 1) AS one
LEFT JOIN "clinic_settings" cs ON cs."id" = 1
WHERE NOT EXISTS (SELECT 1 FROM "spaces");--> statement-breakpoint
UPDATE "patients" SET "space_id" = (SELECT "id" FROM "spaces" ORDER BY "created_at" LIMIT 1) WHERE "space_id" IS NULL;--> statement-breakpoint
INSERT INTO "space_members" ("space_id", "user_id")
SELECT (SELECT "id" FROM "spaces" ORDER BY "created_at" LIMIT 1), "id" FROM "users"
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "space_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_space_id" uuid;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_last_space_id_spaces_id_fk" FOREIGN KEY ("last_space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "patients_space_cin_idx" ON "patients" USING btree ("space_id","cin") WHERE "patients"."cin" is not null;--> statement-breakpoint
CREATE INDEX "patients_space_name_idx" ON "patients" USING btree ("space_id","last_name","first_name");