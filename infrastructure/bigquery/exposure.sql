-- Exposure for one event, counting each policy and location once.
-- Parameter: @event_id (STRING). Same rule as backend/app/services/exposure.py.
-- Zone match is a distance approximation, not a verified impact boundary.
-- Not yet executed against BigQuery in this build. Validate in the console before relying on it.
WITH ev AS (
  SELECT lat, lon, radius_km
  FROM `PROJECT.claimwise.alerts`
  WHERE event_id = @event_id
),
distances AS (
  SELECT
    l.location_id,
    l.policy_id,
    l.tiv_inr,
    -- Haversine distance in km
    2 * 6371 * ASIN(SQRT(
      POW(SIN(RADIANS(l.lat - ev.lat) / 2), 2)
      + COS(RADIANS(ev.lat)) * COS(RADIANS(l.lat)) * POW(SIN(RADIANS(l.lon - ev.lon) / 2), 2)
    )) AS distance_km,
    ev.radius_km
  FROM `PROJECT.claimwise.insured_locations` AS l
  CROSS JOIN ev
)
SELECT
  COUNT(DISTINCT policy_id) AS exposed_policies,
  COUNT(DISTINCT location_id) AS exposed_locations,
  SUM(tiv_inr) AS insured_value_inr
FROM distances
WHERE distance_km <= radius_km;
