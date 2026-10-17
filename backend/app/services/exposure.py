"""Deterministic exposure calculation: which insured locations fall inside an event's radius.

Rules:
- A location is "in zone" when its distance from the event centre is within radius_km.
- A policy is counted once, however many of its locations are in zone (no double counting).
- Insured value is the sum of distinct location TIV (total insured value) in zone.
- Exposure means a policy is in the area. It does not prove damage or coverage.
"""
from app.services.geo import haversine_km
from app.store import store

LIMITATIONS = [
    "Radius match is an approximation, not a verified meteorological impact boundary.",
    "A policy in the affected area does not establish that insured property was damaged.",
    "Insured value is the total insured value of locations in the zone, not expected payout or realised loss.",
    "Scenario events are fictional and simulated unless the source says otherwise.",
]


def locations_in_zone(event: dict) -> list[dict]:
    """Return locations with their distance and zone band (severe or outer), nearest first."""
    result = []
    for loc in store.locations.values():
        d = haversine_km(event["lat"], event["lon"], loc["lat"], loc["lon"])
        if d <= event["radius_km"]:
            zone = "severe" if d <= event["severe_radius_km"] else "outer"
            result.append({**loc, "distance_km": round(d, 1), "zone": zone})
    return sorted(result, key=lambda x: x["distance_km"])


def exposure_for_events(events: list[dict]) -> dict:
    """Exposure across one or more events, counting each policy and location once."""
    loc_ids: dict[str, dict] = {}
    for ev in events:
        for loc in locations_in_zone(ev):
            loc_ids.setdefault(loc["location_id"], loc)
    policy_ids = {loc["policy_id"] for loc in loc_ids.values()}
    total_value = sum(loc["tiv"] for loc in loc_ids.values())
    return {
        "exposed_policies": len(policy_ids),
        "exposed_locations": len(loc_ids),
        "insured_value_inr": total_value,
        "policy_ids": sorted(policy_ids),
        "location_ids": sorted(loc_ids),
    }


def exposure_for_event(event: dict) -> dict:
    """Full exposure breakdown for one event, used by the alert detail page."""
    locs = locations_in_zone(event)
    base = exposure_for_events([event])

    by_product: dict[str, dict] = {}
    seen_policies: set[str] = set()
    for loc in locs:
        pol = store.policies[loc["policy_id"]]
        bucket = by_product.setdefault(pol["policy_type"], {"policy_type": pol["policy_type"], "policies": 0, "insured_value_inr": 0})
        bucket["insured_value_inr"] += loc["tiv"]
        if pol["policy_id"] not in seen_policies:
            seen_policies.add(pol["policy_id"])
            bucket["policies"] += 1

    by_zone = {}
    for zone in ("severe", "outer"):
        zone_locs = [l for l in locs if l["zone"] == zone]
        by_zone[zone] = {
            "exposed_locations": len(zone_locs),
            "exposed_policies": len({l["policy_id"] for l in zone_locs}),
            "insured_value_inr": sum(l["tiv"] for l in zone_locs),
        }

    open_claims = [c for c in store.claims.values() if c.get("event_id") == event["event_id"] and c["status"] != "Closed"]
    return {
        "event_id": event["event_id"],
        **base,
        "by_product": sorted(by_product.values(), key=lambda x: -x["insured_value_inr"]),
        "by_zone": by_zone,
        "locations": locs,
        "open_claims_linked": len(open_claims),
        "limitations": LIMITATIONS,
        "method": f"Haversine distance from event centre; severe ≤ {event['severe_radius_km']} km, outer ≤ {event['radius_km']} km.",
    }
