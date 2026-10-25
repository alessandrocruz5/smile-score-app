CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"smile_score" integer NOT NULL,
	"components" jsonb NOT NULL,
	"blendshapes" jsonb NOT NULL,
	"overlay" jsonb NOT NULL,
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_smile_score_range" CHECK ("uploads"."smile_score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uploads_user_created_idx" ON "uploads" USING btree ("user_id","created_at" DESC NULLS LAST);