"""Readiness plan: exposure, workload assumptions and a task list. Numbers are deterministic. AI text is optional."""
from datetime import date, timedelta

from app.config import get_settings
from app.services import ai
from app.services.exposure import exposure_for_event
from app.store import store

TASK_TEMPLATES = [
    ("outreach", "Policyholder outreach", "Contact exposed policyholders with safety and claim-filing guidance.", "Customer Care", 2, "Exposed policies and their locations"),
    ("emergency_contacts", "Prioritise emergency contacts", "Call policyholders with severe-zone locations first.", "Customer Care", 1, "Severe-zone exposure count"),
    ("adjuster_allocation", "Allocate adjusters", "Assign adjusters to expected claims using the capacity assumptions.", "Claims Operations", 3, "Expected claims and adjuster capacity"),
    ("document_checklist", "Share document checklist", "Send the claim-type document checklist to affected claimants.", "Claims Operations", 2, "Required documents by claim type"),
    ("vendor_coordination", "Coordinate repair vendors", "Confirm repair vendor capacity for the affected region.", "Partner Management", 4, "Expected repair-related claims"),
    ("escalation", "Set escalation path", "Define who reviews high-value and high-priority claims.", "Claims Leadership", 1, "Escalation thresholds in assumptions"),
    ("comms", "Prepare communication templates", "Draft holding messages for policyholders and brokers.", "Communications", 2, "Event and exposure summary"),
]


def _expected(exposure: dict) -> dict:
    a = store.assumptions
    expected_claims = round(exposure["exposed_policies"] * a["claim_rate_per_exposed_policy"])
    capacity_per_day = a["adjusters_available"] * a["claims_handled_per_adjuster_per_day"]
    days = round(expected_claims / capacity_per_day, 1) if capacity_per_day else None
    return {
        "expected_claims": expected_claims,
        "expected_claim_value_inr": expected_claims * a["average_claim_cost_inr"],
        "adjuster_capacity_per_day": capacity_per_day,
        "adjuster_days_needed": days,
        "horizon_days": a["planning_horizon_days"],
        "assumptions": {
            "claim_rate_per_exposed_policy": a["claim_rate_per_exposed_policy"],
            "average_claim_cost_inr": a["average_claim_cost_inr"],
            "adjusters_available": a["adjusters_available"],
            "claims_handled_per_adjuster_per_day": a["claims_handled_per_adjuster_per_day"],
            "source": a["assumption_set"],
        },
    }


def create_plan(event_id: str) -> dict:
    event = store.events[event_id]
    exposure = exposure_for_event(event)
    expected = _expected(exposure)
    base = date.fromisoformat(get_settings().scenario_date)
    severe = exposure["by_zone"]["severe"]["exposed_policies"]
    reported = sum(1 for c in store.claims.values() if c.get("event_id") == event_id)

    tasks = []
    for key, title, detail, owner, due_days, reason in TASK_TEMPLATES:
        reason_text = reason
        if key == "emergency_contacts":
            reason_text = f"{severe} policies are in the severe zone (≤ {event['severe_radius_km']} km)."
        if key == "adjuster_allocation":
            reason_text = f"About {expected['expected_claims']} claims expected; capacity {expected['adjuster_capacity_per_day']} per day."
        tasks.append({
            "task_id": f"TSK-{event_id}-{key}",
            "title": title,
            "detail": detail,
            "owner": owner,
            "due_date": (base + timedelta(days=due_days)).isoformat(),
            "status": "Not started",
            "notes": [],
            "reason": reason_text,
        })

    narrative = ai.readiness_narrative({
        "event_name": event["name"],
        "exposed_policies": exposure["exposed_policies"],
        "insured_value_inr": exposure["insured_value_inr"],
        "expected_claims": expected["expected_claims"],
        "horizon_days": expected["horizon_days"],
    })
    plan = {
        "plan_id": f"PLAN-{event_id}",
        "event_id": event_id,
        "situation": f"{event['name']} ({event['severity']} severity, {event['status']}). {event['severity_basis']}.",
        "affected_region": event["region"],
        "exposure": {k: exposure[k] for k in ("exposed_policies", "exposed_locations", "insured_value_inr")},
        "claims_already_reported": reported,
        "workload": expected,
        "tasks": tasks,
        "narrative": narrative,
        "limitations": [
            "Claim volume is an assumption based on the claim rate, not a forecast.",
            "Insured value is exposure, not expected payout.",
        ],
    }
    store.readiness_plans[plan["plan_id"]] = plan
    return plan


def find_task(task_id: str) -> tuple[dict, dict] | None:
    for plan in store.readiness_plans.values():
        for task in plan["tasks"]:
            if task["task_id"] == task_id:
                return plan, task
    return None
