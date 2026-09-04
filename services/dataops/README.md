# NILAM data operations

This package ingests official artifacts into `staging` and cannot publish from a
connector process. The scraper database role receives insert/select access only
to staging tables. Human review uses a separate credential and a guarded
database function that creates append-only publication versions and outbox
events.

No adapter supplies scheme values, rates, deadlines, eligibility rules, or
other government facts. It only parses values present in the fetched artifact.
Live HTTP is restricted to each adapter's allowlisted HTTPS hosts and uses the
default TLS trust store. Fixtures are used for deterministic tests and portal
outages. Live government hosts can still fail in minimal container CA bundles;
do not weaken verification to work around that.

## Commands

```sh
dataops check
dataops ingest tansidco https://tansidco.tn.gov.in/path/to/source.json \
  --verified-on 2026-08-21
dataops review list
dataops review edit REVIEW_ID replacement.json \
  --reviewer reviewer@example.org --note "Compared with source"
dataops review approve REVIEW_ID --reviewer reviewer@example.org \
  --citation-url https://tansidco.tn.gov.in/path/to/source.json \
  --note "Approved after manual comparison"
dataops review reject REVIEW_ID --reviewer reviewer@example.org \
  --note "Source does not support the proposed value"
```

`DATABASE_URL` is the restricted scraper credential.
`REVIEWER_DATABASE_URL` must be a different credential with membership in
`nilam_reviewer`. OCR is deliberately an interface: image-only documents fail
closed until a reviewed OCR implementation is configured.
