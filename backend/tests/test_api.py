"""API tests. Each test resets the in-memory demo store so ordering does not matter."""
import io

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import ai
from app.store import store

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_store():
    with store.lock:
        store.reset()
    yield


def test_health_reports_demo_mode_and_integrations():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["data_mode"] == "demo"
    services = {i["service"] for i in body["integrations"]}
    assert {"Gemini on Vertex AI", "BigQuery", "Document AI", "Vertex AI Search", "Cloud Storage"} <= services


def test_alerts_list_and_filter():
    r = client.get("/api/alerts")
    assert r.status_code == 200
    assert r.json()["total"] == 4
    assert all(e["is_simulated"] for e in r.json()["items"])
    filtered = client.get("/api/alerts", params={"hazard_type": "cyclone"}).json()
    assert {e["event_id"] for e in filtered["items"]} == {"SIM-CYC-2026-01", "SCN-001"}


def test_unknown_alert_returns_404():
    assert client.get("/api/alerts/NOPE").status_code == 404
    assert client.get("/api/alerts/NOPE/exposure").status_code == 404


def test_claim_filtering_and_pagination():
    r = client.get("/api/claims", params={"claim_type": "motor"})
    assert r.status_code == 200
    assert all(item["claim_type"] == "motor" for item in r.json()["items"])
    paged = client.get("/api/claims", params={"page_size": 4, "page": 2}).json()
    assert paged["page"] == 2 and len(paged["items"]) == 4 and paged["total"] == 15


def test_claim_search_and_bad_input():
    assert client.get("/api/claims", params={"q": "CLM-2003"}).json()["total"] == 1
    assert client.get("/api/claims", params={"page_size": 500}).status_code == 422
    assert client.get("/api/claims", params={"sort": "drop table"}).status_code == 422


def test_claim_detail_and_unknown_claim():
    r = client.get("/api/claims/CLM-2001")
    assert r.status_code == 200
    body = r.json()
    assert body["policy"]["coverage_limit_inr"] == 5000000
    assert body["event"]["event_id"] == "SCN-001"
    assert client.get("/api/claims/CLM-9999").status_code == 404


def test_exposure_counts_each_policy_once():
    body = client.get("/api/alerts/SIM-CYC-2026-01/exposure").json()
    # 17 locations inside the outer radius belong to 16 distinct policies (one policy has two locations inside).
    assert body["exposed_locations"] == 17
    assert body["exposed_policies"] == 16
    assert len(body["policy_ids"]) == len(set(body["policy_ids"])) == 16


def test_scenario_file_exposure_is_consistent():
    body = client.get("/api/alerts/SCN-001/exposure").json()
    assert body["exposed_policies"] == 3
    assert body["exposed_locations"] == 3
    assert body["insured_value_inr"] == 5000000 + 900000 + 3000000
    assert body["insured_value_inr"] == sum(loc["tiv"] for loc in body["locations"])
    assert "not a verified" in " ".join(body["limitations"]).lower()


def test_policy_limit_within_for_scenario_claims():
    r = client.post("/api/claims/CLM-2003/analyze")
    assert r.status_code == 200
    limit_check = next(c for c in r.json()["money_checks"]["checks"] if c["check"] == "policy_limit")
    assert limit_check["status"] == "within"
    assert r.json()["decision_status"].startswith("No decision")


def test_policy_limit_exceeded_is_flagged():
    store.claims["CLM-2003"]["reported_amount"] = 35_00_000  # above the 30 lakh limit
    checks = client.post("/api/claims/CLM-2003/analyze").json()["money_checks"]["checks"]
    assert next(c for c in checks if c["check"] == "policy_limit")["status"] == "exceeds"


def test_scenario_estimate_matches_reported_amount():
    checks = client.post("/api/claims/CLM-2001/analyze").json()["money_checks"]["checks"]
    total = next(c for c in checks if c["check"] == "document_total" and c["evidence_source"] == "DOC-001")
    assert total["status"] == "match"
    assert total["difference_inr"] == 0


def test_contradictory_estimate_total_is_discrepancy():
    store.documents["DOC-001"]["extracted_fields"]["total"] = 412500  # estimate 67,500 below the claim
    checks = client.post("/api/claims/CLM-2001/analyze").json()["money_checks"]["checks"]
    total = next(c for c in checks if c["check"] == "document_total" and c["evidence_source"] == "DOC-001")
    assert total["status"] == "discrepancy"
    assert total["difference_inr"] == 67500


def test_missing_total_is_invalid_when_no_total_field():
    checks = client.post("/api/claims/CLM-2010/analyze").json()["money_checks"]["checks"]
    assert any(c["status"] == "invalid" for c in checks)


def test_missing_documents_follow_claim_type_rules():
    checklist = client.get("/api/claims/CLM-2002").json()["checklist"]
    missing = {i["document_type"] for i in checklist if i["status"] == "missing"}
    assert "vehicle_registration" in missing
    assert "photos" in missing
    assert "repair_estimate" not in missing  # garage estimate is on file


def test_policy_period_outside_is_flagged():
    body = client.post("/api/claims/CLM-2009/analyze").json()
    assert body["period_check"]["status"] == "outside_period"


def test_upload_rejects_bad_type_size_and_magic():
    bad_ext = client.post("/api/claims/CLM-2001/documents", files={"file": ("x.exe", b"MZ", "application/octet-stream")}, data={"document_type": "invoice"})
    assert bad_ext.status_code == 422
    bad_magic = client.post("/api/claims/CLM-2001/documents", files={"file": ("x.pdf", b"not a pdf", "application/pdf")}, data={"document_type": "invoice"})
    assert bad_magic.status_code == 422
    empty = client.post("/api/claims/CLM-2001/documents", files={"file": ("x.pdf", b"", "application/pdf")}, data={"document_type": "invoice"})
    assert empty.status_code == 422
    bad_type = client.post("/api/claims/CLM-2001/documents", files={"file": ("x.pdf", b"%PDF-1.4 ok", "application/pdf")}, data={"document_type": "selfie"})
    assert bad_type.status_code == 422


def test_upload_accepts_valid_pdf_and_does_not_invent_fields(tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    from app.config import get_settings
    get_settings.cache_clear()
    try:
        r = client.post("/api/claims/CLM-2001/documents",
                        files={"file": ("../../evil.pdf", io.BytesIO(b"%PDF-1.4 demo"), "application/pdf")},
                        data={"document_type": "invoice"})
        assert r.status_code == 201
        doc = r.json()
        assert doc["file_name"] == "evil.pdf"  # path parts stripped
        assert doc["processing_status"] == "awaiting_extraction"
        assert doc["extracted_fields"] == {}
        assert doc["extraction_source"] is None
        assert "object_name" in doc and "/" not in doc["object_name"]
    finally:
        get_settings.cache_clear()


def test_unknown_document_returns_404():
    assert client.patch("/api/documents/DOC-NOPE", json={"review_status": "reviewed"}).status_code == 404


def test_document_review_status_update():
    r = client.patch("/api/documents/DOC-002", json={"review_status": "reviewed"})
    assert r.status_code == 200
    assert r.json()["review_status"] == "reviewed"


def test_claim_status_update_and_activity_log():
    r = client.patch("/api/claims/CLM-2004", json={"status": "Under review"})
    assert r.status_code == 200
    detail = client.get("/api/claims/CLM-2004").json()
    assert detail["status"] == "Under review"
    assert any("Under review" in a["text"] for a in detail["activity"])


def test_invalid_status_and_unknown_adjuster_are_rejected():
    assert client.patch("/api/claims/CLM-2004", json={"status": "Approved"}).status_code == 422
    assert client.patch("/api/claims/CLM-2004", json={"adjuster_id": "ADJ-99"}).status_code == 422


def test_evidence_request_requires_document_type():
    assert client.post("/api/claims/CLM-2002/notes", json={"text": "Please send", "kind": "evidence_requested"}).status_code == 422
    r = client.post("/api/claims/CLM-2002/notes", json={"text": "Please send", "kind": "evidence_requested", "document_type": "vehicle_registration"})
    assert r.status_code == 201
    checklist = client.get("/api/claims/CLM-2002").json()["checklist"]
    item = next(i for i in checklist if i["document_type"] == "vehicle_registration")
    assert item["requested"] is True


def test_summary_never_decides_and_keeps_verified_facts():
    body = client.get("/api/claims/CLM-2001/summary").json()
    assert body["decision_status"].startswith("No decision")
    assert body["verified_facts"]["reported_amount_inr"] == 480000
    assert "Coverage interpretation" in body["structured_summary"]["adjuster_decision_required"]


def test_coverage_is_labelled_demo_and_not_decided():
    body = client.get("/api/claims/CLM-2001/coverage").json()
    assert body["retrieval_mode"] == "demo_local_clauses"
    assert "DEMO POLICY DATA" in body["label"]
    assert body["coverage_decision"] == "not_determined"
    groups = body["groups"]
    assert any(c["clause_id"] == "CL-01" for c in client.get("/api/claims/CLM-2001/coverage").json()["groups"]["potentially_covered"])
    # CLM-2003 is a fire claim on POL-A103, which carries the unoccupancy exclusion.
    fire = client.get("/api/claims/CLM-2003/coverage").json()["groups"]
    assert any(c["clause_id"] == "CL-06" for c in fire["potentially_excluded_or_restricted"])
    # CLM-2002 flood is not listed on POL-A102, so the coverage review must send it to a human.
    flood = client.get("/api/claims/CLM-2002/coverage").json()
    assert any("not listed" in m for m in flood["missing_information"])


def test_model_failure_falls_back_to_template(monkeypatch):
    monkeypatch.setenv("GEMINI_ENABLED", "true")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "demo-project")
    from app.config import get_settings
    get_settings.cache_clear()

    def boom(_prompt):
        raise RuntimeError("simulated outage")

    monkeypatch.setattr(ai, "_call_gemini", boom)
    try:
        body = client.get("/api/claims/CLM-2001/summary").json()
        assert body["ai_narrative"]["source"] == "demo_fallback"
        assert body["ai_narrative"]["fallback_reason"] == "RuntimeError"
        assert "human adjuster" in body["ai_narrative"]["text"].lower()
    finally:
        get_settings.cache_clear()


def test_readiness_plan_is_deterministic_and_labelled():
    r = client.post("/api/readiness-plan", json={"event_id": "SIM-CYC-2026-01"})
    assert r.status_code == 201
    plan = r.json()
    assert plan["exposure"]["exposed_policies"] == 16
    assert plan["workload"]["expected_claims"] == round(16 * 0.12)
    assert plan["narrative"]["source"] == "demo_fallback"
    assert len(plan["tasks"]) == 7
    assert all(t["status"] == "Not started" for t in plan["tasks"])
    assert client.post("/api/readiness-plan", json={"event_id": "NOPE"}).status_code == 404


def test_readiness_task_status_update_and_notes():
    plan = client.post("/api/readiness-plan", json={"event_id": "SIM-CYC-2026-01"}).json()
    task_id = plan["tasks"][0]["task_id"]
    r = client.patch(f"/api/readiness-plan/tasks/{task_id}", json={"status": "In progress", "note": "Calls started"})
    assert r.status_code == 200
    assert r.json()["status"] == "In progress"
    assert r.json()["notes"] == ["Calls started"]
    assert client.patch("/api/readiness-plan/tasks/TSK-NOPE", json={"status": "Completed"}).status_code == 404
    assert client.patch(f"/api/readiness-plan/tasks/{task_id}", json={"status": "Done"}).status_code == 422


def test_analytics_endpoints():
    overview = client.get("/api/overview").json()
    assert overview["active_alerts"] == 3  # two active scenarios plus one monitored flood watch
    assert overview["data_label"].startswith("DEMO DATA")
    claims = client.get("/api/analytics/claims").json()
    assert sum(item["count"] for item in claims["by_type"]) == 15
    exposure = client.get("/api/analytics/exposure").json()
    assert any(e["event_id"] == "SIM-CYC-2026-01" for e in exposure["by_event"])
