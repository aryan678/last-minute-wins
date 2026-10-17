"""Deterministic claim checks: document completeness, money checks, policy period and limits.

All arithmetic and date logic happens here. AI services only explain these results.
Findings are discrepancies for investigation. They are not proof of fraud and not coverage decisions.
"""
from datetime import date

from app.services.money import inr
from app.store import store

AMOUNT_TOLERANCE_ABS = 1000  # INR
AMOUNT_TOLERANCE_PCT = 0.02  # 2 percent


def _d(s: str | None) -> date | None:
    try:
        return date.fromisoformat(s[:10]) if s else None
    except ValueError:
        return None


def claim_documents(claim_id: str) -> list[dict]:
    return [d for d in store.documents.values() if d["claim_id"] == claim_id]


def document_checklist(claim: dict) -> list[dict]:
    """Required documents for the claim type, each marked received, missing, needs_review or extraction_failed."""
    docs = claim_documents(claim["claim_id"])
    requested = {n.get("document_type") for n in claim.get("notes", []) if n.get("kind") == "evidence_requested"}
    items = []
    for doc_type in store.required_documents.get(claim["claim_type"], ["claim_form"]):
        matches = [d for d in docs if d["document_type"] == doc_type]
        if not matches:
            status = "missing"
        elif all(d["processing_status"] == "failed" for d in matches):
            status = "extraction_failed"
        elif any(d["processing_status"] in ("pending", "needs_review", "awaiting_extraction") for d in matches):
            status = "needs_review"
        else:
            status = "received"
        items.append({
            "document_type": doc_type,
            "status": status,
            "requested": doc_type in requested,
            "why_needed": store.required_documents_why.get(doc_type, ""),
            "document_ids": [d["document_id"] for d in matches],
        })
    return items


def money_checks(claim: dict) -> dict:
    """Compare the reported amount with supporting totals, the policy limit and the deductible."""
    policy = store.policies[claim["policy_id"]]
    reported = claim["reported_amount"]
    checks = []

    limit = policy["coverage_limit"]
    if reported > limit:
        checks.append(_check("policy_limit", "exceeds", reported, limit,
                             f"Reported amount is above the policy limit of {inr(limit)}.",
                             "Policy schedule", "Adjuster to confirm the limit and any sub-limits."))
    else:
        checks.append(_check("policy_limit", "within", reported, limit,
                             f"Reported amount is within the policy limit of {inr(limit)}.",
                             "Policy schedule", None))

    refs: dict[str, str] = {}
    for doc in claim_documents(claim["claim_id"]):
        fields = doc.get("extracted_fields") or {}
        if doc["document_type"] in ("invoice", "repair_estimate") and doc["processing_status"] in ("extracted", "needs_review"):
            total = fields.get("total")
            if total is None:
                checks.append(_check("document_total", "invalid", reported, None,
                                     f"{doc['file_name']} has no total amount.",
                                     doc["document_id"], "Request a complete estimate or invoice."))
                continue
            diff = reported - total
            tol = max(AMOUNT_TOLERANCE_ABS, AMOUNT_TOLERANCE_PCT * reported)
            status = "match" if abs(diff) <= tol else "discrepancy"
            msg = (f"Reported {inr(reported)} vs {fields.get('issuer', 'document')} total {inr(total)}"
                   f" (difference {inr(diff)}).")
            checks.append(_check("document_total", status, reported, total, msg, doc["document_id"],
                                 "Confirm the difference with the claimant and the supplier." if status == "discrepancy" else None,
                                 confidence=doc.get("extraction_confidence")))
            ref = fields.get("reference")
            if ref:
                if ref in refs and refs[ref] != claim["claim_id"]:
                    checks.append(_check("duplicate_reference", "discrepancy", None, None,
                                         f"Reference {ref} is also used on another claim.", doc["document_id"],
                                         "Check for a duplicate submission."))
                refs[ref] = claim["claim_id"]

    illustrative = None
    best_total = next((c["compared_value"] for c in checks if c["check"] == "document_total" and c["status"] in ("match", "discrepancy")), None)
    if best_total is not None and policy.get("deductible") is not None:
        basis = min(best_total, limit)
        illustrative = {
            "label": "Illustrative only. Not a settlement amount.",
            "basis_inr": basis,
            "deductible_inr": policy["deductible"],
            "result_inr": max(0, basis - policy["deductible"]),
            "assumptions": [
                "Uses the supplier total, capped at the policy limit, minus the flat deductible.",
                "Ignores endorsement-specific deductibles such as CE-2, which need adjuster review.",
            ],
        }

    return {"checks": checks, "illustrative_calculation": illustrative}


def _check(name, status, claim_value, document_value, message, source, next_action, confidence=None) -> dict:
    diff = None
    if claim_value is not None and document_value is not None:
        diff = claim_value - document_value
    return {
        "check": name,
        "status": status,
        "claim_value_inr": claim_value,
        "compared_value": document_value,
        "difference_inr": diff,
        "message": message,
        "evidence_source": source,
        "confidence": confidence,
        "suggested_next_action": next_action,
    }


def period_check(claim: dict) -> dict:
    """Was the policy active on the loss date? Only uses dates on the record."""
    policy = store.policies[claim["policy_id"]]
    loss = _d(claim["loss_date"])
    start, end = _d(policy["effective_from"]), _d(policy["effective_to"])
    if not (loss and start and end):
        return {"status": "unknown", "message": "Loss or policy dates are missing."}
    if start <= loss <= end:
        return {"status": "active", "message": f"Loss date {loss} is within the policy period {start} to {end}."}
    return {"status": "outside_period", "message": f"Loss date {loss} is outside the policy period {start} to {end}. Needs human review."}


def event_match(claim: dict) -> dict:
    """Does the policy list the claim's cause among its covered perils?"""
    policy = store.policies[claim["policy_id"]]
    cause = claim.get("loss_cause")
    if cause in policy["covered_perils"]:
        return {"status": "listed", "message": f"Cause '{cause}' is listed among covered perils."}
    return {"status": "not_listed", "message": f"Cause '{cause}' is not listed among covered perils. Needs human review against the wording."}
