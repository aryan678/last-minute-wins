"""Demo runtime store. Loaded from seed JSON and held in memory.

Changes made through the API last until the process restarts. This is not durable storage.
"""
import copy
import json
from datetime import datetime
from threading import RLock

from app.config import DATA_DIR

_seed = json.loads((DATA_DIR / "seed.json").read_text(encoding="utf-8"))


class Store:
    def __init__(self) -> None:
        self.lock = RLock()
        self.reset()

    def reset(self) -> None:
        d = copy.deepcopy(_seed)
        self.events = {e["event_id"]: e for e in d["events"]}
        self.adjusters = {a["adjuster_id"]: a for a in d["adjusters"]}
        self.policies = {p["policy_id"]: p for p in d["policies"]}
        self.locations = {l["location_id"]: l for l in d["locations"]}
        self.claims = {c["claim_id"]: c for c in d["claims"]}
        self.documents = {x["document_id"]: x for x in d["documents"]}
        self.clauses = d["clauses"]
        self.assumptions = d["assumptions"]
        self.required_documents = d["required_documents"]
        self.required_documents_why = d["required_documents_why"]
        self.readiness_plans: dict[str, dict] = {}

    def log(self, claim_id: str, kind: str, text: str, actor: str = "adjuster") -> None:
        """Append an entry to a claim's activity log."""
        self.claims[claim_id].setdefault("activity", []).append({
            "at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "kind": kind,
            "text": text,
            "actor": actor,
        })


store = Store()
