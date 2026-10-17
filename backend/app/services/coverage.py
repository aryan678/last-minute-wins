"""Policy clause retrieval and grouping.

The live path (Vertex AI Search) is not implemented in this build, so retrieval always uses the
local demo clause set. Results are labelled DEMO POLICY DATA. Nothing here is a coverage decision.
"""
from app.services import claims as claim_svc
from app.store import store

RETRIEVAL_MODE = "demo_local_clauses"  # changes to "vertex_ai_search" only when that adapter exists


def _relevant(clause: dict, claim: dict) -> bool:
    if clause["policy_id"] not in (claim["policy_id"], "ALL"):
        return False
    perils = set(clause["perils"])
    return claim.get("loss_cause") in perils or claim["claim_type"] in perils or clause["kind"] == "procedure"


def coverage_review(claim: dict) -> dict:
    relevant = [c for c in store.clauses if _relevant(c, claim)]
    citation = lambda c: {"clause_id": c["clause_id"], "heading": c["heading"], "text": c["text"], "source": c["source"]}

    covered = [citation(c) for c in relevant if c["kind"] == "coverage"]
    excluded = [citation(c) for c in relevant if c["kind"] == "exclusion"]
    review = [citation(c) for c in relevant if c["kind"] in ("endorsement", "condition")]

    period = claim_svc.period_check(claim)
    peril = claim_svc.event_match(claim)
    missing_info = []
    if period["status"] != "active":
        missing_info.append(period["message"])
    if peril["status"] != "listed":
        missing_info.append(peril["message"])
    missing_docs = [i["document_type"] for i in claim_svc.document_checklist(claim) if i["status"] in ("missing", "extraction_failed")]
    if missing_docs:
        missing_info.append("Documents still missing or failed: " + ", ".join(missing_docs) + ".")
    if not relevant:
        missing_info.append("No policy wording found for this cause in the available clause set.")

    return {
        "retrieval_mode": RETRIEVAL_MODE,
        "label": "DEMO POLICY DATA. Synthetic clauses for demonstration only.",
        "coverage_decision": "not_determined",
        "decision_note": "ClaimWise does not make coverage decisions. A human adjuster reviews the wording.",
        "period_check": period,
        "peril_check": peril,
        "groups": {
            "potentially_covered": covered,
            "potentially_excluded_or_restricted": excluded,
            "needs_human_review": review + [{"clause_id": None, "heading": m, "text": m, "source": "Claim record"} for m in missing_info],
        },
        "missing_information": missing_info,
    }
