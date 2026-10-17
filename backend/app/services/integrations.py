"""Status of each Google Cloud integration. Used by /health and the Settings page.

Only Gemini on Vertex AI has a live code path in this build. The other services report
`not_implemented` or `not_configured` and the app runs its labelled demo path instead.
"""
from app.config import get_settings
from app.services import ai


def integration_status() -> list[dict]:
    s = get_settings()
    return [
        {"service": "Gemini on Vertex AI", "purpose": "Narrative summaries and readiness text", **ai.status(),
         "implemented": True},
        {"service": "BigQuery", "purpose": "Exposure and claim analytics", "configured": bool(s.gcp_project),
         "implemented": False, "mode": "demo_fallback",
         "note": "SQL is in infrastructure/bigquery. Live query not wired in this build; demo calculations run in Python."},
        {"service": "Document AI", "purpose": "Invoice and estimate extraction", "configured": bool(s.document_ai_processor),
         "implemented": False, "mode": "not_implemented",
         "note": "Uploads are stored and marked awaiting extraction. Seed documents carry demo_seed fields."},
        {"service": "Vertex AI Search", "purpose": "Policy clause retrieval", "configured": bool(s.search_datastore),
         "implemented": False, "mode": "demo_fallback",
         "note": "Retrieval uses the local DEMO POLICY DATA clause set."},
        {"service": "Cloud Storage", "purpose": "Claim document storage", "configured": bool(s.gcs_bucket),
         "implemented": False, "mode": "local_demo_storage",
         "note": "Files are stored in local demo storage."},
    ]
