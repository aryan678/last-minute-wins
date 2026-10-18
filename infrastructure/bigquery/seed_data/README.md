# BigQuery seed data

These newline-delimited JSON files were derived from `backend/app/data/seed.json` and contain only the columns defined in `infrastructure/bigquery/schema.sql`.

The source seed uses `tiv`, `coverage_limit`, `deductible`, and `reported_amount`; these files map those to the BigQuery column names `tiv_inr`, `coverage_limit_inr`, `deductible_inr`, and `reported_amount_inr`.

## Load into an existing dataset

Run these commands from the repository root in Cloud Shell or a terminal with the BigQuery CLI (`bq`) installed. Replace `YOUR_PROJECT_ID` with your Google Cloud project ID. The dataset and tables must already exist, created using `schema.sql`.

```bash
bq load --source_format=NEWLINE_DELIMITED_JSON YOUR_PROJECT_ID:claimwise.alerts infrastructure/bigquery/seed_data/alerts.ndjson
bq load --source_format=NEWLINE_DELIMITED_JSON YOUR_PROJECT_ID:claimwise.policies infrastructure/bigquery/seed_data/policies.ndjson
bq load --source_format=NEWLINE_DELIMITED_JSON YOUR_PROJECT_ID:claimwise.insured_locations infrastructure/bigquery/seed_data/insured_locations.ndjson
bq load --source_format=NEWLINE_DELIMITED_JSON YOUR_PROJECT_ID:claimwise.claims infrastructure/bigquery/seed_data/claims.ndjson
bq load --source_format=NEWLINE_DELIMITED_JSON YOUR_PROJECT_ID:claimwise.documents infrastructure/bigquery/seed_data/documents.ndjson
```

`bq load` appends rows by default. If you rerun these commands, rows will be duplicated. To replace a table's contents instead, add `--replace` to that table's command.

For `exposure.sql`, at minimum load `alerts.ndjson` and `insured_locations.ndjson`. These are fictional synthetic demo records, not real insurance data.
