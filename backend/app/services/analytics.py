"""Portfolio and claims analytics, computed from the store. The same logic is written as SQL in infrastructure/bigquery."""
from collections import Counter, defaultdict

from app.services import claims as claim_svc
from app.services.exposure import exposure_for_events
from app.store import store

ACTIVE_EVENT_STATUSES = {"active", "monitoring"}
REVIEW_STATUSES = {"Under review", "Additional evidence required", "Escalated for human review", "Ready for adjuster decision"}


def _active_events() -> list[dict]:
    return [e for e in store.events.values() if e["status"] in ACTIVE_EVENT_STATUSES]


def overview() -> dict:
    claims = list(store.claims.values())
    active = _active_events()
    exposure = exposure_for_events(active)
    awaiting_docs = [c for c in claims if any(i["status"] == "missing" for i in claim_svc.document_checklist(c))]
    return {
        "active_alerts": len(active),
        "exposed_policies": exposure["exposed_policies"],
        "insured_value_exposed_inr": exposure["insured_value_inr"],
        "open_claims": sum(1 for c in claims if c["status"] != "Closed"),
        "claims_awaiting_documents": len(awaiting_docs),
        "claims_requiring_review": sum(1 for c in claims if c["status"] in REVIEW_STATUSES),
        "data_mode": "demo",
        "data_label": "DEMO DATA: synthetic records. Simulated events are not official warnings.",
    }


def claims_analytics() -> dict:
    claims = list(store.claims.values())
    by_type = Counter(c["claim_type"] for c in claims)
    by_status = Counter(c["status"] for c in claims)
    by_adjuster = Counter(c["adjuster_id"] for c in claims)
    amounts = defaultdict(list)
    for c in claims:
        amounts[c["claim_type"]].append(c["reported_amount"])
    docs = list(store.documents.values())
    total_required = 0
    total_received = 0
    for c in claims:
        for item in claim_svc.document_checklist(c):
            total_required += 1
            total_received += item["status"] == "received"
    return {
        "data_label": "DEMO DATA",
        "by_type": [{"claim_type": k, "count": v} for k, v in by_type.most_common()],
        "by_status": [{"status": k, "count": v} for k, v in by_status.most_common()],
        "average_reported_loss_by_type": [
            {"claim_type": k, "average_inr": round(sum(v) / len(v))} for k, v in amounts.items()
        ],
        "workload_by_adjuster": [{"adjuster_id": k, "name": store.adjusters[k]["name"], "open_claims": sum(1 for c in claims if c["adjuster_id"] == k and c["status"] != "Closed")}
                                 for k in store.adjusters],
        "claims_linked_to_active_events": sum(1 for c in claims if c.get("event_id") in {e["event_id"] for e in _active_events()}),
        "document_completion_rate": round(total_received / total_required, 3) if total_required else None,
        "documents_total": len(docs),
        "claims_awaiting_evidence": sum(1 for c in claims if any(i["status"] == "missing" for i in claim_svc.document_checklist(c))),
    }


def exposure_analytics() -> dict:
    events = list(store.events.values())
    per_event = []
    for e in events:
        ex = exposure_for_events([e])
        per_event.append({"event_id": e["event_id"], "name": e["name"], "status": e["status"], **ex, "policy_ids": None, "location_ids": None})
    return {
        "data_label": "DEMO DATA",
        "note": "Exposed insured value is not realised loss or expected payout.",
        "by_event": per_event,
    }
