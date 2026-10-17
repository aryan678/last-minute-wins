// Shapes returned by the ClaimWise backend. Keep in sync with backend/app/api/routes.py and services.

export type ClaimStatus =
  | "FNOL received"
  | "Awaiting documents"
  | "Documents received"
  | "Under review"
  | "Additional evidence required"
  | "Escalated for human review"
  | "Ready for adjuster decision"
  | "Closed";

export interface AlertEvent {
  event_id: string;
  hazard_type: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  radius_km: number;
  severe_radius_km: number;
  severity: string;
  severity_basis: string;
  status: string;
  detected_at: string;
  expected_window: string;
  confidence: string;
  source_name: string;
  source_url: string | null;
  is_simulated: boolean;
  data_freshness: string;
  description: string;
}

export interface ExposureLocation {
  location_id: string;
  policy_id: string;
  label: string;
  lat: number;
  lon: number;
  tiv: number;
  distance_km: number;
  zone: "severe" | "outer";
}

export interface Exposure {
  event_id: string;
  exposed_policies: number;
  exposed_locations: number;
  insured_value_inr: number;
  by_product: { policy_type: string; policies: number; insured_value_inr: number }[];
  by_zone: Record<"severe" | "outer", { exposed_locations: number; exposed_policies: number; insured_value_inr: number }>;
  locations: ExposureLocation[];
  open_claims_linked: number;
  limitations: string[];
  method: string;
}

export interface Overview {
  active_alerts: number;
  exposed_policies: number;
  insured_value_exposed_inr: number;
  open_claims: number;
  claims_awaiting_documents: number;
  claims_requiring_review: number;
  data_mode: string;
  data_label: string;
}

export interface ClaimRow {
  claim_id: string;
  policy_id: string;
  policyholder: string;
  claim_type: string;
  event_id: string | null;
  location_label: string;
  reported_amount_inr: number;
  status: ClaimStatus;
  adjuster: { adjuster_id: string; name: string | null };
  reported_date: string;
  loss_date: string;
  missing_document_count: number;
  priority: string;
  last_updated: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ChecklistItem {
  document_type: string;
  status: "received" | "missing" | "needs_review" | "extraction_failed";
  requested: boolean;
  why_needed: string;
  document_ids: string[];
}

export interface DocumentRecord {
  document_id: string;
  claim_id: string;
  file_name: string;
  document_type: string;
  uploaded_at: string;
  processing_status: string;
  extraction_source: string | null;
  extracted_fields: Record<string, unknown>;
  extraction_confidence: number | null;
  review_status: "unreviewed" | "reviewed";
  storage: string;
}

export interface MoneyCheck {
  check: string;
  status: string;
  claim_value_inr: number | null;
  compared_value: number | null;
  difference_inr: number | null;
  message: string;
  evidence_source: string;
  confidence: number | null;
  suggested_next_action: string | null;
}

export interface ClaimDetail extends ClaimRow {
  incident_location: string;
  loss_cause: string;
  policy: {
    policy_id: string;
    policy_type: string;
    insured_item: string;
    coverage_limit_inr: number;
    deductible_inr: number;
    effective_from: string;
    effective_to: string;
    covered_perils: string[];
    exclusions: string[];
    endorsements: string[];
  };
  event: { event_id: string; name: string; is_simulated: boolean } | null;
  checklist: ChecklistItem[];
  activity: { at: string; kind: string; text: string; actor: string }[];
  notes: { text: string; kind: string; document_type: string | null; author: string; at: string }[];
}

export interface Clause {
  clause_id: string;
  heading: string;
  text: string;
  source: string;
}

export interface CoverageReview {
  retrieval_mode: string;
  label: string;
  coverage_decision: string;
  decision_note: string;
  period_check: { status: string; message: string };
  peril_check: { status: string; message: string };
  groups: {
    potentially_covered: Clause[];
    potentially_excluded_or_restricted: Clause[];
    needs_human_review: Clause[];
  };
  missing_information: string[];
}

export interface Analysis {
  claim_id: string;
  checklist: ChecklistItem[];
  money_checks: {
    checks: MoneyCheck[];
    illustrative_calculation: {
      label: string;
      basis_inr: number;
      deductible_inr: number;
      result_inr: number;
      assumptions: string[];
    } | null;
  };
  period_check: { status: string; message: string };
  event_match: { status: string; message: string };
  decision_status: string;
}

export interface ClaimSummary {
  claim_id: string;
  verified_facts: Record<string, unknown>;
  structured_summary: {
    what_happened: string;
    claimed_loss_inr: number;
    documents_received: string[];
    documents_missing: string[];
    documents_needing_review: string[];
    financial_discrepancies: string[];
    potentially_relevant_provisions: string[];
    exclusions_or_restrictions: string[];
    uncertainties: string[];
    recommended_next_steps: string[];
    adjuster_decision_required: string[];
  };
  ai_narrative: { source: "vertex_ai" | "demo_fallback"; model: string | null; text: string; fallback_reason?: string };
  decision_status: string;
}

export interface ReadinessTask {
  task_id: string;
  title: string;
  detail: string;
  owner: string;
  due_date: string;
  status: "Not started" | "In progress" | "Completed";
  notes: string[];
  reason: string;
}

export interface ReadinessPlan {
  plan_id: string;
  event_id: string;
  situation: string;
  affected_region: string;
  exposure: { exposed_policies: number; exposed_locations: number; insured_value_inr: number };
  claims_already_reported: number;
  workload: {
    expected_claims: number;
    expected_claim_value_inr: number;
    adjuster_capacity_per_day: number;
    adjuster_days_needed: number | null;
    horizon_days: number;
    assumptions: Record<string, string | number>;
  };
  tasks: ReadinessTask[];
  narrative: { source: "vertex_ai" | "demo_fallback"; model: string | null; text: string };
  limitations: string[];
}

export interface Health {
  status: string;
  data_mode: string;
  integrations: { service: string; configured: boolean; implemented: boolean; mode?: string; note: string | null; model?: string | null }[];
}
