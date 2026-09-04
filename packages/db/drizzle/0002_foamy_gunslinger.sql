CREATE TABLE "staging"."review_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_item_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"note" text NOT NULL,
	"reviewed_data" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staged_review_actions_action_check" CHECK ("staging"."review_actions"."action" in ('approved', 'rejected', 'needs_changes'))
);
--> statement-breakpoint
ALTER TABLE "staging"."review_actions" ADD CONSTRAINT "review_actions_review_item_id_review_queue_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "staging"."review_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staged_review_actions_item_idx" ON "staging"."review_actions" USING btree ("review_item_id","at");--> statement-breakpoint
CREATE FUNCTION staging.prevent_review_action_mutation() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'review_actions are append-only';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER review_actions_immutable
	BEFORE UPDATE OR DELETE ON staging.review_actions
	FOR EACH ROW EXECUTE FUNCTION staging.prevent_review_action_mutation();--> statement-breakpoint
GRANT SELECT, INSERT ON staging.review_actions TO nilam_reviewer;