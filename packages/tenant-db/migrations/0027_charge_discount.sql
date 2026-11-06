ALTER TABLE "charges" ADD COLUMN "discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_discount_positive" CHECK ("charges"."discount" >= 0);