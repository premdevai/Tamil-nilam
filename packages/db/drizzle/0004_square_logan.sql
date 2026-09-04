CREATE TYPE "public"."account_request_status" AS ENUM('queued', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'telegram');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sending', 'delivered', 'failed', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."operation_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "account_data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" "account_request_status" DEFAULT 'queued' NOT NULL,
	"storage_key" text,
	"expires_at" timestamp with time zone,
	"error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_data_requests_kind_check" CHECK ("account_data_requests"."kind" in ('export', 'deletion'))
);
--> statement-breakpoint
CREATE TABLE "audit_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "auth_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_authenticators" (
	"credential_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_account_id" text NOT NULL,
	"credential_public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"credential_device_type" text NOT NULL,
	"credential_backed_up" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "auth_authenticators_user_id_credential_id_pk" PRIMARY KEY("user_id","credential_id"),
	CONSTRAINT "auth_authenticators_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"granted" boolean NOT NULL,
	"source" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrective_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"replacement_publication_id" uuid,
	"requested_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"proposed_data" jsonb NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"version_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"impact_event_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"provider_message_id" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"telegram_enabled" boolean DEFAULT false NOT NULL,
	"deadline_reminders" boolean DEFAULT true NOT NULL,
	"go_change_alerts" boolean DEFAULT true NOT NULL,
	"vacancy_alerts" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "operation_job_status" DEFAULT 'queued' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_playbook_progress" (
	"user_id" uuid NOT NULL,
	"playbook_id" uuid NOT NULL,
	"completed_step_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_playbook_progress_user_id_playbook_id_pk" PRIMARY KEY("user_id","playbook_id")
);
--> statement-breakpoint
CREATE TABLE "watched_estates" (
	"user_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"vacancy_alerts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watched_estates_user_id_estate_id_pk" PRIMARY KEY("user_id","estate_id")
);
--> statement-breakpoint
ALTER TABLE "saved_stacks" DROP CONSTRAINT "saved_stacks_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "publication_versions_review_item_idx";--> statement-breakpoint
DROP INDEX "saved_stacks_user_idx";--> statement-breakpoint
ALTER TABLE "saved_stacks" ADD COLUMN "name" text DEFAULT 'Saved stack' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_stacks" ADD COLUMN "result_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_stacks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "account_data_requests" ADD CONSTRAINT "account_data_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_records" ADD CONSTRAINT "audit_records_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_authenticators" ADD CONSTRAINT "auth_authenticators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_versions" ADD CONSTRAINT "corrective_versions_publication_id_publication_versions_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publication_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_versions" ADD CONSTRAINT "corrective_versions_replacement_publication_id_publication_versions_id_fk" FOREIGN KEY ("replacement_publication_id") REFERENCES "public"."publication_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_versions" ADD CONSTRAINT "corrective_versions_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_versions" ADD CONSTRAINT "corrective_versions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_impact_event_id_impact_events_id_fk" FOREIGN KEY ("impact_event_id") REFERENCES "public"."impact_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_playbook_progress" ADD CONSTRAINT "user_playbook_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_playbook_progress" ADD CONSTRAINT "user_playbook_progress_playbook_id_playbooks_id_fk" FOREIGN KEY ("playbook_id") REFERENCES "public"."playbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watched_estates" ADD CONSTRAINT "watched_estates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watched_estates" ADD CONSTRAINT "watched_estates_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_data_requests_user_idx" ON "account_data_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_records_actor_idx" ON "audit_records" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_records_target_idx" ON "audit_records" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_authenticators_user_idx" ON "auth_authenticators" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_verification_tokens_token_idx" ON "auth_verification_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "consent_records_user_idx" ON "consent_records" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE INDEX "corrective_versions_status_idx" ON "corrective_versions" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "impact_events_version_idx" ON "impact_events" USING btree ("kind","entity_type","entity_id","version_key");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_idempotency_idx" ON "notification_deliveries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notification_deliveries_retry_idx" ON "notification_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_user_idx" ON "notification_deliveries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "operation_jobs_idempotency_idx" ON "operation_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "operation_jobs_status_idx" ON "operation_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_link_tokens_hash_idx" ON "telegram_link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "telegram_link_tokens_user_idx" ON "telegram_link_tokens" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "watched_estates_estate_idx" ON "watched_estates" USING btree ("estate_id");--> statement-breakpoint
ALTER TABLE "saved_stacks" ADD CONSTRAINT "saved_stacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_stacks_user_hash_idx" ON "saved_stacks" USING btree ("user_id","result_hash");--> statement-breakpoint
CREATE INDEX "publication_versions_review_item_idx" ON "publication_versions" USING btree ("review_item_id");--> statement-breakpoint
CREATE INDEX "saved_stacks_user_idx" ON "saved_stacks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_account_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% records are append-only', TG_TABLE_NAME;
END;
$$;--> statement-breakpoint
CREATE TRIGGER audit_records_append_only
BEFORE UPDATE OR DELETE ON audit_records
FOR EACH ROW EXECUTE FUNCTION prevent_account_audit_mutation();--> statement-breakpoint
CREATE TRIGGER consent_records_append_only
BEFORE UPDATE OR DELETE ON consent_records
FOR EACH ROW EXECUTE FUNCTION prevent_account_audit_mutation();