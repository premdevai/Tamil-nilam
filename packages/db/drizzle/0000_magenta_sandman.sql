CREATE EXTENSION IF NOT EXISTS "postgis";
--> statement-breakpoint
CREATE SCHEMA "staging";
--> statement-breakpoint
CREATE TYPE "public"."agency_kind" AS ENUM('tansidco', 'sipcot', 'government', 'financial', 'other');--> statement-breakpoint
CREATE TYPE "public"."confirmation_level" AS ENUM('go_text', 'dic_written', 'dic_verbal', 'inferred');--> statement-breakpoint
CREATE TYPE "public"."conflict_kind" AS ENUM('exclusive', 'caution');--> statement-breakpoint
CREATE TYPE "public"."dpr_status" AS ENUM('queued', 'generating', 'ready', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."plot_status" AS ENUM('vacant', 'allotted', 'litigation', 'reserved', 'pending_cancel', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected', 'needs_changes');--> statement-breakpoint
CREATE TYPE "public"."scheme_level" AS ENUM('central', 'state');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'active', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'consultant', 'reviewer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_action" AS ENUM('created', 'verified', 'published', 'corrected', 'retired');--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_ta" text,
	"kind" "agency_kind" NOT NULL,
	"apply_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflict_pairs" (
	"scheme_a_id" uuid NOT NULL,
	"scheme_b_id" uuid NOT NULL,
	"kind" "conflict_kind" NOT NULL,
	"rationale_md" text NOT NULL,
	"confirmed_at" "confirmation_level" NOT NULL,
	"go_reference_id" uuid,
	"verified_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conflict_pairs_scheme_a_id_scheme_b_id_pk" PRIMARY KEY("scheme_a_id","scheme_b_id"),
	CONSTRAINT "conflict_pairs_order_check" CHECK ("conflict_pairs"."scheme_a_id" <> "conflict_pairs"."scheme_b_id")
);
--> statement-breakpoint
CREATE TABLE "estates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_ta" text,
	"district" text NOT NULL,
	"block" text,
	"backward_block" boolean DEFAULT false NOT NULL,
	"centroid" "geography",
	"boundary" "geography",
	"rates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"infrastructure" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_url" text NOT NULL,
	"verified_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "estates"
	ADD CONSTRAINT "estates_centroid_valid_check"
	CHECK ("centroid" IS NULL OR (ST_IsValid("centroid"::geometry) AND GeometryType("centroid"::geometry) = 'POINT')),
	ADD CONSTRAINT "estates_boundary_valid_check"
	CHECK ("boundary" IS NULL OR (ST_IsValid("boundary"::geometry) AND GeometryType("boundary"::geometry) IN ('POLYGON', 'MULTIPOLYGON')));
--> statement-breakpoint
CREATE TABLE "generated_dprs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"payment_id" uuid,
	"status" "dpr_status" DEFAULT 'queued' NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"ruleset_snapshot" jsonb NOT NULL,
	"document_version" integer DEFAULT 1 NOT NULL,
	"docx_storage_key" text,
	"pdf_storage_key" text,
	"expires_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "go_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"go_number" text NOT NULL,
	"go_date" date NOT NULL,
	"url" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"provider_payment_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "payment_status" NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive_check" CHECK ("payments"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "playbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"archetype" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estate_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"plot_number" text NOT NULL,
	"area_cents" numeric(14, 4),
	"status" "plot_status" DEFAULT 'unknown' NOT NULL,
	"geom" "geography",
	"source_synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plots"
	ADD CONSTRAINT "plots_geom_valid_check"
	CHECK ("geom" IS NULL OR (ST_IsValid("geom"::geometry) AND GeometryType("geom"::geometry) IN ('POLYGON', 'MULTIPOLYGON')));
--> statement-breakpoint
CREATE TABLE "staging"."raw_source_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector" text NOT NULL,
	"source_url" text NOT NULL,
	"content_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_key" text NOT NULL,
	"source_document_id" uuid NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"proposed_data" jsonb NOT NULL,
	"field_diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"go_reference_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"rule_json" jsonb NOT NULL,
	"verified_on" date NOT NULL,
	"verified_by" text NOT NULL,
	"changelog_md" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_versions_effective_range_check" CHECK ("rule_versions"."effective_to" is null or "rule_versions"."effective_to" >= "rule_versions"."effective_from")
);
--> statement-breakpoint
CREATE FUNCTION prevent_rule_version_mutation() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'rule_versions are append-only; publish a corrective version';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER rule_versions_immutable
	BEFORE UPDATE OR DELETE ON "rule_versions"
	FOR EACH ROW EXECUTE FUNCTION prevent_rule_version_mutation();
--> statement-breakpoint
CREATE TABLE "saved_stacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"telegram_chat_id" text,
	"inputs" jsonb NOT NULL,
	"result_hash" text NOT NULL,
	"ruleset_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_ta" text,
	"level" "scheme_level" NOT NULL,
	"department" text NOT NULL,
	"summary_md" text NOT NULL,
	"apply_steps_md" text NOT NULL,
	"docs_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"portal_url" text,
	"sunset_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"content_hash" text,
	"published_on" date,
	"retrieved_at" timestamp with time zone NOT NULL,
	"mime_type" text,
	"storage_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging"."records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_key" text NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"field_diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"plan" text NOT NULL,
	"status" "subscription_status" NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"telegram_chat_id" text,
	"name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"consented_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "verification_action" NOT NULL,
	"actor_id" uuid,
	"actor_label" text NOT NULL,
	"source_document_id" uuid,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conflict_pairs" ADD CONSTRAINT "conflict_pairs_scheme_a_id_schemes_id_fk" FOREIGN KEY ("scheme_a_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_pairs" ADD CONSTRAINT "conflict_pairs_scheme_b_id_schemes_id_fk" FOREIGN KEY ("scheme_b_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_pairs" ADD CONSTRAINT "conflict_pairs_go_reference_id_go_references_id_fk" FOREIGN KEY ("go_reference_id") REFERENCES "public"."go_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estates" ADD CONSTRAINT "estates_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estates" ADD CONSTRAINT "estates_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD CONSTRAINT "generated_dprs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD CONSTRAINT "generated_dprs_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "go_references" ADD CONSTRAINT "go_references_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "go_references" ADD CONSTRAINT "go_references_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plots" ADD CONSTRAINT "plots_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plots" ADD CONSTRAINT "plots_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_go_reference_id_go_references_id_fk" FOREIGN KEY ("go_reference_id") REFERENCES "public"."go_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_stacks" ADD CONSTRAINT "saved_stacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging"."records" ADD CONSTRAINT "records_snapshot_id_raw_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "staging"."raw_source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agencies_slug_idx" ON "agencies" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "estates_slug_idx" ON "estates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "estates_district_idx" ON "estates" USING btree ("district");--> statement-breakpoint
CREATE INDEX "generated_dprs_user_idx" ON "generated_dprs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "go_references_scheme_number_idx" ON "go_references" USING btree ("scheme_id","go_number");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_id_idx" ON "payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_idx" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "playbooks_slug_idx" ON "playbooks" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "plots_estate_number_idx" ON "plots" USING btree ("estate_id","plot_number");--> statement-breakpoint
CREATE INDEX "plots_status_idx" ON "plots" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_source_snapshots_connector_hash_idx" ON "staging"."raw_source_snapshots" USING btree ("connector","content_hash");--> statement-breakpoint
CREATE INDEX "review_items_status_idx" ON "review_items" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_versions_scheme_version_idx" ON "rule_versions" USING btree ("scheme_id","version");--> statement-breakpoint
CREATE INDEX "saved_stacks_user_idx" ON "saved_stacks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schemes_slug_idx" ON "schemes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "source_documents_url_hash_idx" ON "source_documents" USING btree ("url","content_hash");--> statement-breakpoint
CREATE INDEX "source_documents_agency_idx" ON "source_documents" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "staged_records_entity_idx" ON "staging"."records" USING btree ("entity_type","entity_key");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_id_idx" ON "subscriptions" USING btree ("provider_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_chat_idx" ON "users" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE INDEX "verification_logs_entity_idx" ON "verification_logs" USING btree ("entity_type","entity_id");