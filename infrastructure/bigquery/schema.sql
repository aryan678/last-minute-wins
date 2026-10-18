-- ClaimWise AI BigQuery schema. Replace ai-builder-cup-511918 and DATASET with your values.
-- Synthetic demo data only. Create the dataset in the same region as Cloud Run (for example us-central1).

CREATE SCHEMA IF NOT EXISTS `ai-builder-cup-511918.claimwise`
OPTIONS (location = "us-central1");

CREATE OR REPLACE TABLE `ai-builder-cup-511918.claimwise.alerts` (
  event_id STRING NOT NULL,
  hazard_type STRING,
  name STRING,
  region STRING,
  lat FLOAT64,
  lon FLOAT64,
  radius_km FLOAT64,
  severe_radius_km FLOAT64,
  severity STRING,
  status STRING,
  detected_at TIMESTAMP,
  source_name STRING,
  is_simulated BOOL
);

CREATE OR REPLACE TABLE `ai-builder-cup-511918.claimwise.policies` (
  policy_id STRING NOT NULL,
  policy_type STRING,
  insured_item STRING,
  coverage_limit_inr NUMERIC,
  deductible_inr NUMERIC,
  effective_from DATE,
  effective_to DATE,
  covered_perils ARRAY<STRING>
);

CREATE OR REPLACE TABLE `ai-builder-cup-511918.claimwise.insured_locations` (
  location_id STRING NOT NULL,
  policy_id STRING NOT NULL,
  label STRING,
  lat FLOAT64,
  lon FLOAT64,
  tiv_inr NUMERIC
);

CREATE OR REPLACE TABLE `ai-builder-cup-511918.claimwise.claims` (
  claim_id STRING NOT NULL,
  policy_id STRING NOT NULL,
  claim_type STRING,
  event_id STRING,
  loss_date DATE,
  reported_date DATE,
  loss_cause STRING,
  reported_amount_inr NUMERIC,
  status STRING,
  adjuster_id STRING,
  priority STRING
);

CREATE OR REPLACE TABLE `ai-builder-cup-511918.claimwise.documents` (
  document_id STRING NOT NULL,
  claim_id STRING NOT NULL,
  document_type STRING,
  file_name STRING,
  uploaded_at TIMESTAMP,
  processing_status STRING,
  extraction_confidence FLOAT64
);
