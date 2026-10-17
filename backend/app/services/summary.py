"""Claim summary. The structured summary is deterministic. Gemini may only add a narrative from these facts."""
from app.services import ai, claims as claim_svc, coverage as coverage_svc
from app.store import store


def build_summary(claim: dict) -> dict:
    checklist = claim_svc.document_checklist(claim)
    money = claim_svc.money_checks(claim)
    coverage = coverage_svc.coverage_review(claim)
    event = store.events.get(claim.get("event_id") or "")

    received = [i["document_type"] for i in checklist if i["status"] == "received"]
    missing = [i["document_type"] for i in checklist if i["status"] == "missing"]
    review = [i["document_type"] for i in checklist if i["status"] in ("needs_review", "extraction_failed")]
    issues = [c["message"] for c in money["checks"] if c["status"] in ("exceeds", "discrepancy", "invalid")]
    issues += [coverage["period_check"]["message"]] if coverage["period_check"]["status"] == "outside_period" else []

    facts = {
        "claim_id": claim["claim_id"],
        "claim_type": claim["claim_type"],
        "event": event["name"] if event else None,
        "reported_amount_inr": claim["reported_amount"],
        "documents_received": received,
        "documents_missing": missing,
        "documents_needing_review": review,
        "amount_issues": issues,
        "clauses_retrieved": [c["clause_id"] for g in coverage["groups"].values() for c in g if c.get("clause_id")],
    }

    next_steps = []
    if missing:
        next_steps.append(f"Request missing documents: {', '.join(missing)}.")
    if review:
        next_steps.append(f"Review documents that failed or need checking: {', '.join(review)}.")
    if issues:
        next_steps.append("Resolve the amount differences before any settlement discussion.")
    if coverage["period_check"]["status"] == "outside_period":
        next_steps.append("Confirm whether the loss date falls within the policy period.")
    next_steps.append("Adjuster to review coverage wording and make the decision.")

    structured = {
        "what_happened": f"Reported {claim['claim_type'].replace('_', ' ')} loss on {claim['loss_date']} caused by {claim.get('loss_cause')}"
                         + (f", linked to {event['name']}." if event else "."),
        "claimed_loss_inr": claim["reported_amount"],
        "documents_received": received,
        "documents_missing": missing,
        "documents_needing_review": review,
        "financial_discrepancies": issues,
        "potentially_relevant_provisions": [c["heading"] for c in coverage["groups"]["potentially_covered"]],
        "exclusions_or_restrictions": [c["heading"] for c in coverage["groups"]["potentially_excluded_or_restricted"]],
        "uncertainties": coverage["missing_information"],
        "recommended_next_steps": next_steps,
        "adjuster_decision_required": ["Coverage interpretation", "Final settlement amount", "Any discrepancy above"],
    }
    narrative = ai.claim_narrative(facts)
    return {
        "claim_id": claim["claim_id"],
        "verified_facts": facts,
        "structured_summary": structured,
        "ai_narrative": narrative,
        "decision_status": "No decision. Human adjuster review required.",
    }
