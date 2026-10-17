"""HTTP routes. Routes stay thin: validation and business logic live in services."""
from datetime import datetime
from math import ceil

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile

from app.config import get_settings
from app.schemas import ClaimPatchIn, DocumentPatchIn, NoteIn, ReadinessPlanIn, TaskPatchIn
from app.services import analytics, claims as claim_svc, coverage as coverage_svc, readiness
from app.services import documents as doc_svc
from app.services import integrations, summary as summary_svc
from app.services.exposure import exposure_for_event
from app.store import store

router = APIRouter(prefix="/api")

PAGE_SIZE_MAX = 100


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def not_found(kind: str, ident: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{kind} '{ident}' was not found.")


def _claim_or_404(claim_id: str) -> dict:
    claim = store.claims.get(claim_id)
    if not claim:
        raise not_found("Claim", claim_id)
    return claim


def _claim_row(c: dict) -> dict:
    missing = sum(1 for i in claim_svc.document_checklist(c) if i["status"] == "missing")
    adj = store.adjusters.get(c["adjuster_id"], {})
    return {
        "claim_id": c["claim_id"],
        "policy_id": c["policy_id"],
        "policyholder": c["policyholder"],
        "claim_type": c["claim_type"],
        "event_id": c.get("event_id"),
        "location_label": c["location_label"],
        "reported_amount_inr": c["reported_amount"],
        "status": c["status"],
        "adjuster": {"adjuster_id": c["adjuster_id"], "name": adj.get("name")},
        "reported_date": c["reported_date"],
        "loss_date": c["loss_date"],
        "missing_document_count": missing,
        "priority": c["priority"],
        "last_updated": c["last_updated"],
    }


@router.get("/health")
def health():
    return {"status": "ok", "data_mode": "demo", "integrations": integrations.integration_status()}


@router.get("/overview")
def overview():
    return analytics.overview()


@router.get("/alerts")
def list_alerts(status: str | None = None, hazard_type: str | None = None):
    events = list(store.events.values())
    if status:
        events = [e for e in events if e["status"] == status]
    if hazard_type:
        events = [e for e in events if e["hazard_type"] == hazard_type]
    return {"items": events, "total": len(events)}


@router.get("/alerts/{alert_id}")
def get_alert(alert_id: str):
    event = store.events.get(alert_id)
    if not event:
        raise not_found("Alert", alert_id)
    return event


@router.get("/alerts/{alert_id}/exposure")
def get_alert_exposure(alert_id: str):
    event = store.events.get(alert_id)
    if not event:
        raise not_found("Alert", alert_id)
    return exposure_for_event(event)


@router.get("/claims")
def list_claims(
    q: str | None = Query(default=None, max_length=100),
    claim_type: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    event_id: str | None = None,
    adjuster_id: str | None = None,
    sort: str = Query(default="last_updated", pattern="^(last_updated|reported_amount|reported_date|claim_id)$"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=PAGE_SIZE_MAX),
):
    rows = [_claim_row(c) for c in store.claims.values()]
    if q:
        needle = q.lower()
        rows = [r for r in rows if needle in " ".join([r["claim_id"], r["policy_id"], r["policyholder"], r["location_label"]]).lower()]
    if claim_type:
        rows = [r for r in rows if r["claim_type"] == claim_type]
    if status:
        rows = [r for r in rows if r["status"] == status]
    if priority:
        rows = [r for r in rows if r["priority"] == priority]
    if event_id:
        rows = [r for r in rows if r["event_id"] == event_id]
    if adjuster_id:
        rows = [r for r in rows if r["adjuster"]["adjuster_id"] == adjuster_id]
    key_fn = {
        "reported_amount": lambda r: r["reported_amount_inr"],
        "reported_date": lambda r: r["reported_date"],
        "claim_id": lambda r: r["claim_id"],
        "last_updated": lambda r: r["last_updated"],
    }[sort]
    rows.sort(key=key_fn, reverse=(order == "desc"))
    total = len(rows)
    start = (page - 1) * page_size
    return {
        "items": rows[start:start + page_size],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": max(1, ceil(total / page_size)),
    }


@router.get("/claims/{claim_id}")
def get_claim(claim_id: str):
    claim = _claim_or_404(claim_id)
    policy = store.policies[claim["policy_id"]]
    event = store.events.get(claim.get("event_id") or "")
    adj = store.adjusters.get(claim["adjuster_id"], {})
    return {
        **_claim_row(claim),
        "incident_location": claim["incident_location"],
        "loss_cause": claim["loss_cause"],
        "policy": {
            "policy_id": policy["policy_id"], "policy_type": policy["policy_type"],
            "insured_item": policy["insured_item"], "coverage_limit_inr": policy["coverage_limit"],
            "deductible_inr": policy["deductible"], "effective_from": policy["effective_from"],
            "effective_to": policy["effective_to"], "covered_perils": policy["covered_perils"],
            "exclusions": policy["exclusions"], "endorsements": policy["endorsements"],
        },
        "event": {"event_id": event["event_id"], "name": event["name"], "is_simulated": event["is_simulated"]} if event else None,
        "adjuster": {"adjuster_id": claim["adjuster_id"], "name": adj.get("name")},
        "checklist": claim_svc.document_checklist(claim),
        "activity": claim.get("activity", []),
        "notes": claim.get("notes", []),
    }


@router.get("/claims/{claim_id}/documents")
def list_documents(claim_id: str):
    claim = _claim_or_404(claim_id)
    docs = [d for d in store.documents.values() if d["claim_id"] == claim["claim_id"]]
    return {"items": docs, "total": len(docs), "checklist": claim_svc.document_checklist(claim)}


@router.post("/claims/{claim_id}/documents", status_code=201)
async def upload_document(claim_id: str, request: Request, file: UploadFile = File(...), document_type: str = Form(...)):
    claim = _claim_or_404(claim_id)
    max_bytes = int(get_settings().max_upload_mb * 1024 * 1024)
    # Read at most one byte past the limit so oversized uploads are rejected without buffering them whole.
    content = await file.read(max_bytes + 1)
    try:
        record = doc_svc.store_upload(claim["claim_id"], file.filename or "", content, document_type)
    except doc_svc.UploadError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return record


@router.post("/claims/{claim_id}/analyze")
def analyze_claim(claim_id: str):
    claim = _claim_or_404(claim_id)
    money = claim_svc.money_checks(claim)
    period = claim_svc.period_check(claim)
    checklist = claim_svc.document_checklist(claim)
    store.log(claim_id, "analysis", "Ran deterministic checks: documents, amounts, policy period and limit.", actor="system")
    return {
        "claim_id": claim_id,
        "checklist": checklist,
        "money_checks": money,
        "period_check": period,
        "event_match": claim_svc.event_match(claim),
        "decision_status": "No decision. Human adjuster review required.",
    }


@router.get("/claims/{claim_id}/summary")
def get_summary(claim_id: str):
    return summary_svc.build_summary(_claim_or_404(claim_id))


@router.get("/claims/{claim_id}/coverage")
def get_coverage(claim_id: str):
    return coverage_svc.coverage_review(_claim_or_404(claim_id))


@router.post("/claims/{claim_id}/notes", status_code=201)
def add_note(claim_id: str, body: NoteIn):
    claim = _claim_or_404(claim_id)
    if body.kind == "evidence_requested" and not body.document_type:
        raise HTTPException(status_code=422, detail="document_type is required when requesting evidence.")
    entry = {"text": body.text, "kind": body.kind, "document_type": body.document_type, "author": body.author,
             "at": now_iso()}
    claim.setdefault("notes", []).append(entry)
    label = {"evidence_requested": f"Requested {body.document_type}.", "evidence_received": "Evidence received.",
             "review_completed": "Review completed.", "note": "Adjuster note added."}[body.kind]
    store.log(claim_id, "note", label, actor=body.author)
    return entry


@router.patch("/claims/{claim_id}")
def patch_claim(claim_id: str, body: ClaimPatchIn):
    claim = _claim_or_404(claim_id)
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide status or adjuster_id to update.")
    if "adjuster_id" in changes and changes["adjuster_id"] not in store.adjusters:
        raise HTTPException(status_code=422, detail=f"Unknown adjuster '{changes['adjuster_id']}'.")
    if "status" in changes:
        store.log(claim_id, "status", f"Status changed from '{claim['status']}' to '{changes['status']}'.")
        claim["status"] = changes["status"]
    if "adjuster_id" in changes:
        store.log(claim_id, "assignment", f"Assigned to {store.adjusters[changes['adjuster_id']]['name']}.")
        claim["adjuster_id"] = changes["adjuster_id"]
    claim["last_updated"] = now_iso()
    return _claim_row(claim)


@router.patch("/documents/{document_id}")
def patch_document(document_id: str, body: DocumentPatchIn):
    doc = store.documents.get(document_id)
    if not doc:
        raise not_found("Document", document_id)
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide review_status to update.")
    doc.update(changes)
    store.log(doc["claim_id"], "document", f"{doc['file_name']} marked {changes['review_status']}.")
    return doc


@router.get("/analytics/exposure")
def analytics_exposure():
    return analytics.exposure_analytics()


@router.get("/analytics/claims")
def analytics_claims():
    return analytics.claims_analytics()


@router.post("/readiness-plan", status_code=201)
def create_readiness_plan(body: ReadinessPlanIn):
    if body.event_id not in store.events:
        raise not_found("Alert", body.event_id)
    return readiness.create_plan(body.event_id)


@router.get("/readiness-plan/{plan_id}")
def get_readiness_plan(plan_id: str):
    plan = store.readiness_plans.get(plan_id)
    if not plan:
        raise not_found("Readiness plan", plan_id)
    return plan


@router.patch("/readiness-plan/tasks/{task_id}")
def patch_task(task_id: str, body: TaskPatchIn):
    found = readiness.find_task(task_id)
    if not found:
        raise not_found("Task", task_id)
    _, task = found
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide status or note to update.")
    if "status" in changes:
        task["status"] = changes["status"]
    if "note" in changes:
        task["notes"].append(changes["note"])
    return task
