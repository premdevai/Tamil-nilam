CREATE TYPE "public"."bulk_run_status" AS ENUM('queued', 'running', 'ready', 'failed');--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider" text DEFAULT 'razorpay' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "grace_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_provider_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_order_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider" text DEFAULT 'razorpay' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_order_idx" ON "payments" USING btree ("provider_order_id");--> statement-breakpoint

CREATE TABLE "payment_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "signature" text NOT NULL,
  "payload_hash" text NOT NULL,
  "raw_payload" jsonb NOT NULL,
  "processed_at" timestamp with time zone,
  "processing_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_provider_id_idx" ON "payment_webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_unprocessed_idx" ON "payment_webhook_events" USING btree ("processed_at");--> statement-breakpoint

CREATE TABLE "payment_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_id" uuid NOT NULL,
  "receipt_number" text NOT NULL,
  "provider_receipt_url" text,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "payment_receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX "payment_receipts_payment_idx" ON "payment_receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_receipts_number_idx" ON "payment_receipts" USING btree ("receipt_number");--> statement-breakpoint

CREATE TABLE "entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "key" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_source_key_idx" ON "entitlements" USING btree ("user_id","key","source_type","source_id");--> statement-breakpoint
CREATE INDEX "entitlements_access_idx" ON "entitlements" USING btree ("user_id","key","ends_at","revoked_at");--> statement-breakpoint

CREATE TABLE "client_workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "consultant_user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "contact_email" text,
  "external_reference" text,
  "notes" text,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "client_workspaces_consultant_user_id_users_id_fk" FOREIGN KEY ("consultant_user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX "client_workspaces_consultant_idx" ON "client_workspaces" USING btree ("consultant_user_id","created_at");--> statement-breakpoint

CREATE TABLE "business_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "client_workspace_id" uuid,
  "name" text NOT NULL,
  "profile_data" jsonb NOT NULL,
  "profile_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "business_profiles_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
  CONSTRAINT "business_profiles_client_workspace_id_client_workspaces_id_fk" FOREIGN KEY ("client_workspace_id") REFERENCES "public"."client_workspaces"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX "business_profiles_owner_idx" ON "business_profiles" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "business_profiles_owner_hash_idx" ON "business_profiles" USING btree ("owner_user_id","profile_hash");--> statement-breakpoint

CREATE TABLE "bulk_stack_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "client_workspace_id" uuid,
  "status" "bulk_run_status" DEFAULT 'queued' NOT NULL,
  "input_rows" jsonb NOT NULL,
  "result_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "row_count" integer NOT NULL,
  "ruleset_version" text NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "bulk_stack_runs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
  CONSTRAINT "bulk_stack_runs_client_workspace_id_client_workspaces_id_fk" FOREIGN KEY ("client_workspace_id") REFERENCES "public"."client_workspaces"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX "bulk_stack_runs_owner_idx" ON "bulk_stack_runs" USING btree ("owner_user_id","created_at");--> statement-breakpoint

CREATE TABLE "usage_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "capability" text NOT NULL,
  "period_key" text NOT NULL,
  "quantity" integer NOT NULL,
  "idempotency_key" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "usage_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
  CONSTRAINT "usage_ledger_quantity_positive_check" CHECK ("usage_ledger"."quantity" > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX "usage_ledger_idempotency_idx" ON "usage_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "usage_ledger_quota_idx" ON "usage_ledger" USING btree ("user_id","capability","period_key");--> statement-breakpoint

ALTER TABLE "generated_dprs" ADD COLUMN "client_workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD COLUMN "business_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
UPDATE "generated_dprs" SET "idempotency_key" = 'legacy:' || "id"::text WHERE "idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "generated_dprs" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD COLUMN "input_hash" text;--> statement-breakpoint
UPDATE "generated_dprs" SET "input_hash" = md5("input_snapshot"::text) WHERE "input_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "generated_dprs" ALTER COLUMN "input_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD COLUMN "ruleset_hash" text;--> statement-breakpoint
UPDATE "generated_dprs" SET "ruleset_hash" = md5("ruleset_snapshot"::text) WHERE "ruleset_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "generated_dprs" ALTER COLUMN "ruleset_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD COLUMN "validation_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD COLUMN "generation_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD CONSTRAINT "generated_dprs_client_workspace_id_client_workspaces_id_fk" FOREIGN KEY ("client_workspace_id") REFERENCES "public"."client_workspaces"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD CONSTRAINT "generated_dprs_business_profile_id_business_profiles_id_fk" FOREIGN KEY ("business_profile_id") REFERENCES "public"."business_profiles"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "generated_dprs" ADD CONSTRAINT "generated_dprs_document_version_positive_check" CHECK ("generated_dprs"."document_version" > 0);--> statement-breakpoint
CREATE UNIQUE INDEX "generated_dprs_idempotency_idx" ON "generated_dprs" USING btree ("idempotency_key");
