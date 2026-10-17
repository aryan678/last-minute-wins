"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { AlertEvent, Exposure } from "@/lib/types";
import { inr } from "@/lib/format";

const SEVERITY_COLOR: Record<string, string> = { Low: "#64748b", Moderate: "#f59e0b", High: "#ea580c", Severe: "#dc2626" };

interface Props {
  events: AlertEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  exposure: Exposure | null;
}

/** Interactive map: event impact circles, severity markers, and insured locations inside the zone.
 *  Tiles: OpenStreetMap (https://tile.openstreetmap.org). Public tile usage policy applies. Not a hazard forecast. */
export default function ExposureMap({ events, selectedId, onSelect, exposure }: Props) {
  const center: [number, number] = events.length ? [events[0].lat, events[0].lon] : [17.7, 83.3];
  return (
    <MapContainer center={center} zoom={7} scrollWheelZoom className="h-[460px] w-full rounded-lg" aria-label="Catastrophe map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {events.map((ev) => {
        const color = SEVERITY_COLOR[ev.severity] ?? "#64748b";
        const selected = ev.event_id === selectedId;
        return (
          <Circle
            key={`zone-${ev.event_id}`}
            center={[ev.lat, ev.lon]}
            radius={ev.radius_km * 1000}
            pathOptions={{ color, fillColor: color, fillOpacity: selected ? 0.18 : 0.07, weight: selected ? 2 : 1, dashArray: "6 4" }}
            eventHandlers={{ click: () => onSelect(ev.event_id) }}
          />
        );
      })}
      {events.map((ev) => (
        <CircleMarker
          key={`ev-${ev.event_id}`}
          center={[ev.lat, ev.lon]}
          radius={ev.event_id === selectedId ? 10 : 7}
          pathOptions={{ color: "#fff", weight: 2, fillColor: SEVERITY_COLOR[ev.severity] ?? "#64748b", fillOpacity: 1 }}
          eventHandlers={{ click: () => onSelect(ev.event_id) }}
        >
          <Tooltip>{ev.name}</Tooltip>
          <Popup>
            <div className="space-y-1 text-xs">
              <p className="font-semibold">{ev.name}</p>
              <p>{ev.event_id} · {ev.hazard_type} · {ev.severity}</p>
              <p>{ev.is_simulated ? "SIMULATED. Not an official warning." : "Source: " + ev.source_name}</p>
              <p>Radius {ev.radius_km} km (severe ≤ {ev.severe_radius_km} km)</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      {exposure && exposure.locations.map((loc) => (
        <CircleMarker
          key={loc.location_id}
          center={[loc.lat, loc.lon]}
          radius={4}
          pathOptions={{ color: loc.zone === "severe" ? "#7f1d1d" : "#1e3a8a", weight: 1, fillColor: loc.zone === "severe" ? "#ef4444" : "#3b82f6", fillOpacity: 0.9 }}
        >
          <Tooltip>{loc.label} · {loc.policy_id} · {inr(loc.tiv)}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
