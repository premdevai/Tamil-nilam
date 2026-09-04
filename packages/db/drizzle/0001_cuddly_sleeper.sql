CREATE TABLE "publication_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "publication_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_item_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_key" text NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"verifier" text NOT NULL,
	"citation_url" text NOT NULL,
	"source_hash" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging"."review_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_key" text NOT NULL,
	"proposed_data" jsonb NOT NULL,
	"field_diff" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_url" text NOT NULL,
	"content_hash" text NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_data" jsonb,
	"reviewer" text,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging"."records" ALTER COLUMN "field_diff" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "staging"."raw_source_snapshots" ADD COLUMN "raw_body" "bytea" NOT NULL;--> statement-breakpoint
ALTER TABLE "staging"."raw_source_snapshots" ADD COLUMN "mime_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "staging"."records" ADD COLUMN "source_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "staging"."records" ADD COLUMN "verified_on" date;--> statement-breakpoint
ALTER TABLE "staging"."records" ADD COLUMN "deadline_on" date;--> statement-breakpoint
ALTER TABLE "publication_outbox" ADD CONSTRAINT "publication_outbox_publication_id_publication_versions_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publication_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_versions" ADD CONSTRAINT "publication_versions_review_item_id_review_queue_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "staging"."review_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging"."review_queue" ADD CONSTRAINT "review_queue_snapshot_id_raw_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "staging"."raw_source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_outbox_publication_kind_idx" ON "publication_outbox" USING btree ("publication_id","kind");--> statement-breakpoint
CREATE INDEX "publication_outbox_unprocessed_idx" ON "publication_outbox" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_versions_entity_version_idx" ON "publication_versions" USING btree ("entity_type","entity_key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_versions_review_item_idx" ON "publication_versions" USING btree ("review_item_id");--> statement-breakpoint
CREATE INDEX "staged_review_queue_status_idx" ON "staging"."review_queue" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staged_review_queue_snapshot_entity_idx" ON "staging"."review_queue" USING btree ("snapshot_id","entity_type","entity_key");--> statement-breakpoint
CREATE UNIQUE INDEX "staged_records_snapshot_entity_idx" ON "staging"."records" USING btree ("snapshot_id","entity_type","entity_key");--> statement-breakpoint
CREATE FUNCTION prevent_publication_version_mutation() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'publication_versions are append-only; publish a corrective version';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER publication_versions_immutable
	BEFORE UPDATE OR DELETE ON "publication_versions"
	FOR EACH ROW EXECUTE FUNCTION prevent_publication_version_mutation();--> statement-breakpoint
CREATE FUNCTION staging.has_monetary_value(value jsonb) RETURNS boolean AS $$
DECLARE
	entry record;
BEGIN
	IF jsonb_typeof(value) = 'object' THEN
		FOR entry IN SELECT key, value FROM jsonb_each(value)
		LOOP
			IF entry.key ~* '(amount|benefit|capital|cost|grant|incentive|investment|loan|paise|rate|rupee|subsidy)'
			   AND jsonb_typeof(entry.value) <> 'null' THEN
				RETURN true;
			END IF;
			IF staging.has_monetary_value(entry.value) THEN
				RETURN true;
			END IF;
		END LOOP;
	ELSIF jsonb_typeof(value) = 'array' THEN
		FOR entry IN SELECT value FROM jsonb_array_elements(value)
		LOOP
			IF staging.has_monetary_value(entry.value) THEN
				RETURN true;
			END IF;
		END LOOP;
	END IF;
	RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;--> statement-breakpoint
CREATE FUNCTION staging.publish_review_item(
	p_review_item_id uuid,
	p_verifier text,
	p_citation_url text
) RETURNS uuid AS $$
DECLARE
	item staging.review_queue%ROWTYPE;
	v_data jsonb;
	v_version integer;
	v_publication_id uuid := gen_random_uuid();
BEGIN
	IF btrim(p_verifier) = '' THEN
		RAISE EXCEPTION 'verifier identity is required';
	END IF;
	IF p_citation_url !~ '^https?://[^/[:space:]]+' THEN
		RAISE EXCEPTION 'an absolute citation URL is required';
	END IF;

	SELECT * INTO item
	FROM staging.review_queue
	WHERE id = p_review_item_id
	FOR UPDATE;

	IF NOT FOUND OR item.status <> 'approved' THEN
		RAISE EXCEPTION 'only an approved review item can be published';
	END IF;
	IF item.reviewer IS DISTINCT FROM p_verifier OR item.reviewed_at IS NULL THEN
		RAISE EXCEPTION 'approval verifier does not match the review audit record';
	END IF;
	IF item.review_note IS NULL OR btrim(item.review_note) = '' THEN
		RAISE EXCEPTION 'an approval audit note is required';
	END IF;
	v_data := coalesce(item.reviewed_data, item.proposed_data);
	IF lower(substring(p_citation_url from '^https?://([^/]+)'))
		   IS DISTINCT FROM lower(substring(item.source_url from '^https?://([^/]+)'))
	   AND lower(substring(p_citation_url from '^https?://([^/]+)'))
		   IS DISTINCT FROM lower(substring(v_data->>'url' from '^https?://([^/]+)')) THEN
		RAISE EXCEPTION 'citation host must match the reviewed official source';
	END IF;
	IF NOT EXISTS (
		SELECT 1
		FROM staging.raw_source_snapshots snapshot
		WHERE snapshot.id = item.snapshot_id
		  AND snapshot.content_hash = item.content_hash
	) THEN
		RAISE EXCEPTION 'review source hash does not match its immutable snapshot';
	END IF;

	v_data := v_data || jsonb_build_object('citation_url', p_citation_url);
	IF staging.has_monetary_value(v_data)
	   AND (
		   NOT (v_data ? 'verified_on')
		   OR jsonb_typeof(v_data->'verified_on') <> 'string'
	   ) THEN
		RAISE EXCEPTION 'monetary facts require verified_on and citation_url';
	END IF;

	PERFORM pg_advisory_xact_lock(
		hashtextextended(item.entity_type || ':' || item.entity_key, 0)
	);
	SELECT coalesce(max(version), 0) + 1 INTO v_version
	FROM publication_versions
	WHERE entity_type = item.entity_type AND entity_key = item.entity_key;

	INSERT INTO publication_versions (
		id, review_item_id, entity_type, entity_key, version, data,
		verifier, citation_url, source_hash
	) VALUES (
		v_publication_id, item.id, item.entity_type, item.entity_key, v_version,
		v_data, p_verifier, p_citation_url, item.content_hash
	);

	INSERT INTO publication_outbox (publication_id, kind, payload)
	SELECT
		v_publication_id,
		kind,
		jsonb_build_object(
			'entity_type', item.entity_type,
			'entity_key', item.entity_key,
			'version', v_version
		)
	FROM unnest(ARRAY[
		'search.update',
		'pages.invalidate',
		'notifications.evaluate'
	]) AS kind;

	RETURN v_publication_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, staging;--> statement-breakpoint
REVOKE ALL ON FUNCTION staging.publish_review_item(uuid, text, text) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nilam_scraper') THEN
		CREATE ROLE nilam_scraper NOLOGIN;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nilam_reviewer') THEN
		CREATE ROLE nilam_reviewer NOLOGIN;
	END IF;
END
$$;--> statement-breakpoint
REVOKE ALL ON SCHEMA public FROM nilam_scraper;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
	ON ALL TABLES IN SCHEMA public FROM nilam_scraper;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
	ON TABLES FROM nilam_scraper;--> statement-breakpoint
GRANT USAGE ON SCHEMA staging TO nilam_scraper;--> statement-breakpoint
GRANT SELECT, INSERT ON staging.raw_source_snapshots, staging.records, staging.review_queue TO nilam_scraper;--> statement-breakpoint
GRANT USAGE ON SCHEMA staging TO nilam_reviewer;--> statement-breakpoint
GRANT SELECT, UPDATE ON staging.review_queue TO nilam_reviewer;--> statement-breakpoint
GRANT SELECT ON staging.raw_source_snapshots, publication_versions, publication_outbox TO nilam_reviewer;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION staging.publish_review_item(uuid, text, text) TO nilam_reviewer;