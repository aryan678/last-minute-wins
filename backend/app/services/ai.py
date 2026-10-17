"""Gemini on Vertex AI, used only for narrative text.

- Inputs are verified facts only (IDs, counts, amounts, clause IDs). No policyholder names are sent.
- Output must be JSON with a `narrative` string. Anything else falls back.
- If Gemini is disabled or fails, a template narrative is returned and labelled as the demo fallback.
"""
import json
import logging

from app.config import get_settings
from app.services.money import inr

log = logging.getLogger("claimwise.ai")

SYSTEM_RULES = (
    "You are writing for an insurance adjuster. Use only the facts provided. "
    "Do not invent amounts, dates, documents, clauses or policy terms. "
    "Do not say a claim is approved, rejected or fraudulent. "
    "Say that a human adjuster makes the decision. Respond with JSON: {\"narrative\": \"...\"}."
)


def status() -> dict:
    s = get_settings()
    configured = bool(s.gemini_enabled and s.gcp_project)
    return {
        "service": "Gemini on Vertex AI",
        "configured": configured,
        "mode": "vertex_ai" if configured else "demo_fallback",
        "model": s.gemini_model,
        "note": None if configured else "Set GEMINI_ENABLED=true and GOOGLE_CLOUD_PROJECT to enable.",
    }


def _call_gemini(prompt: str) -> str:
    from google import genai  # imported lazily so the demo runs without the SDK

    s = get_settings()
    client = genai.Client(vertexai=True, project=s.gcp_project, location=s.gcp_region)
    response = client.models.generate_content(
        model=s.gemini_model,
        contents=prompt,
        config={"system_instruction": SYSTEM_RULES, "response_mime_type": "application/json", "temperature": 0.2},
    )
    return response.text or ""


def generate(facts: dict, fallback_text: str, purpose: str) -> dict:
    """Return {source, model, text}. Never raises."""
    s = get_settings()
    if not status()["configured"]:
        return {"source": "demo_fallback", "model": None, "text": fallback_text, "purpose": purpose}
    try:
        raw = _call_gemini(f"Purpose: {purpose}\nVerified facts (JSON):\n{json.dumps(facts, default=str)}")
        parsed = json.loads(raw)
        text = parsed.get("narrative", "").strip()
        if not text:
            raise ValueError("empty narrative")
        return {"source": "vertex_ai", "model": s.gemini_model, "text": text, "purpose": purpose}
    except Exception as exc:  # any SDK, network, auth or parse failure falls back
        log.warning("Gemini call failed, using demo fallback: %s", type(exc).__name__)
        return {"source": "demo_fallback", "model": None, "text": fallback_text,
                "purpose": purpose, "fallback_reason": type(exc).__name__}


def claim_narrative(facts: dict) -> dict:
    received = ", ".join(facts["documents_received"]) or "none"
    missing = ", ".join(facts["documents_missing"]) or "none"
    fallback = (
        f"Claim {facts['claim_id']} ({facts['claim_type'].replace('_', ' ')}) reports {inr(facts['reported_amount_inr'])}. "
        f"Documents received: {received}. Documents missing: {missing}. "
        f"{len(facts['amount_issues'])} amount issue(s) found. "
        "This is decision support only. A human adjuster makes the decision."
    )
    return generate(facts, fallback, "claim_summary")


def readiness_narrative(facts: dict) -> dict:
    fallback = (
        f"Event {facts['event_name']} may affect {facts['exposed_policies']} policies "
        f"({inr(facts['insured_value_inr'])} insured value in the approximate zone). "
        f"Planning assumes about {facts['expected_claims']} claims over {facts['horizon_days']} days. "
        "These are planning assumptions, not confirmed claim volumes."
    )
    return generate(facts, fallback, "readiness_plan")
