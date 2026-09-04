DROP INDEX IF EXISTS "generated_dprs_idempotency_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "generated_dprs_idempotency_idx" ON "generated_dprs" USING btree ("user_id","idempotency_key");--> statement-breakpoint

CREATE TABLE "printable_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "client_workspace_id" uuid,
  "status" "dpr_status" DEFAULT 'queued' NOT NULL,
  "idempotency_key" text NOT NULL,
  "input_snapshot" jsonb NOT NULL,
  "ruleset_snapshot" jsonb NOT NULL,
  "input_hash" text NOT NULL,
  "ruleset_hash" text NOT NULL,
  "document_version" integer DEFAULT 1 NOT NULL,
  "docx_storage_key" text,
  "pdf_storage_key" text,
  "expires_at" timestamp with time zone,
  "error" text,
  "generation_attempts" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "printable_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
  CONSTRAINT "printable_reports_client_workspace_id_client_workspaces_id_fk" FOREIGN KEY ("client_workspace_id") REFERENCES "public"."client_workspaces"("id") ON DELETE set null,
  CONSTRAINT "printable_reports_document_version_positive_check" CHECK ("printable_reports"."document_version" > 0)
);--> statement-breakpoint
CREATE INDEX "printable_reports_user_idx" ON "printable_reports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "printable_reports_idempotency_idx" ON "printable_reports" USING btree ("user_id","idempotency_key");
