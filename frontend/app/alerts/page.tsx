"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { compactInr, dateTimeLabel, inr, label } from "@/lib/format";
import { Card, DemoBanner, ErrorState, Kpi, Loading } from "@/components/ui";

const ExposureMap = dynamic(() => import("@/components/ExposureMap"), {
  ssr: false,
  loading: () => <Loading label="Loading map…" />,
});

export default function AlertsPage() {
  const [hazard, setHazard] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const alerts = useApi(() => api.alerts());

  const events = useMemo(() => (alerts.data?.items ?? []).filter(
    (e) => (!hazard || e.hazard_type === hazard) && (!status || e.status === status),
  ), [alerts.data, hazard, status]);

  const activeId = selected ?? events[0]?.event_id ?? null;
  const event = events.find((e) => e.event_id === activeId) ?? null;
  const exposure = useApi(() => (activeId ? api.alertExposure(activeId) : Promise.resolve(null)), [activeId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Catastrophe intelligence</h1>
          <p className="text-sm text-slate-500">Alerts, affected areas and the insured locations inside them.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <select aria-label="Hazard type" value={hazard} onChange={(e) => setHazard(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
            <option value="">All hazards</option>
            {["cyclone", "flood", "fire", "storm", "earthquake", "wildfire"].map((h) => <option key={h} value={h}>{label(h)}</option>)}
          </select>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
            <option value="">All statuses</option>
            {["active", "monitoring", "closed"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
      </div>

      <DemoBanner text="SIMULATED events are fictional scenarios for demonstration. They are not official warnings or forecasts." />

      {alerts.error ? <ErrorState message={alerts.error} onRetry={alerts.reload} /> : alerts.loading ? <Loading /> : (
        <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
          <Card title="Active events" subtitle={`${events.length} shown`}>
            <ul className="space-y-2">
              {events.length === 0 && <li className="text-sm text-slate-500">No events match these filters.</li>}
              {events.map((e) => (
                <li key={e.event_id}>
                  <button
                    onClick={() => setSelected(e.event_id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${e.event_id === activeId ? "border-brand-500 bg-indigo-50/60" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{e.name}</span>
                      <span className="text-xs font-medium text-slate-600">{e.severity}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{e.event_id} · {label(e.hazard_type)} · {label(e.status)}</p>
                    <p className="text-xs text-slate-500">Radius {e.radius_km} km · {e.is_simulated ? "SIMULATED" : "LIVE"}</p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-5">
            <Card title="Impact map" subtitle="Dashed circles are approximate impact areas, not verified boundaries. Red dots are insured locations within the zone.">
              <ExposureMap events={events} selectedId={activeId} onSelect={setSelected} exposure={exposure.data} />
            </Card>

            {event && (
              <Card title={event.name} subtitle={`${event.event_id} · ${event.region}`}>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <Field k="Event type" v={label(event.hazard_type)} />
                  <Field k="Severity" v={`${event.severity}. ${event.severity_basis}`} />
                  <Field k="Status" v={label(event.status)} />
                  <Field k="Detected" v={dateTimeLabel(event.detected_at)} />
                  <Field k="Expected window" v={event.expected_window} />
                  <Field k="Confidence" v={event.confidence} />
                  <Field k="Source" v={event.source_name} />
                  <Field k="Data freshness" v={event.data_freshness} />
                  <Field k="Data type" v={event.is_simulated ? "SIMULATED" : "LIVE"} />
                  <Field k="Coordinates" v={`${event.lat.toFixed(3)}, ${event.lon.toFixed(3)}`} />
                  <Field k="Impact radius" v={`${event.radius_km} km (severe ≤ ${event.severe_radius_km} km)`} />
                </dl>
                <p className="mt-3 text-sm text-slate-600">{event.description}</p>
              </Card>
            )}

            {exposure.loading && <Loading label="Calculating exposure…" />}
            {exposure.error && <ErrorState message={exposure.error} onRetry={exposure.reload} />}
            {exposure.data && (
              <Card title="Exposure" subtitle={exposure.data.method}>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Kpi label="Policies exposed" value={String(exposure.data.exposed_policies)} hint="Each policy counted once" />
                  <Kpi label="Locations exposed" value={String(exposure.data.exposed_locations)} />
                  <Kpi label="Insured value" value={compactInr(exposure.data.insured_value_inr)} hint={inr(exposure.data.insured_value_inr)} />
                  <Kpi label="Open claims linked" value={String(exposure.data.open_claims_linked)} href={`/claims?event_id=${exposure.data.event_id}`} />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By product</h3>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {exposure.data.by_product.map((p) => (
                          <tr key={p.policy_type}><td className="py-1.5">{p.policy_type}</td><td className="text-right">{p.policies} policies</td><td className="text-right tabular-nums">{compactInr(p.insured_value_inr)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By zone</h3>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {(["severe", "outer"] as const).map((z) => (
                          <tr key={z}><td className="py-1.5 capitalize">{z}</td><td className="text-right">{exposure.data!.by_zone[z].exposed_policies} policies</td><td className="text-right tabular-nums">{compactInr(exposure.data!.by_zone[z].insured_value_inr)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Limitations and assumptions</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {exposure.data.limitations.map((l) => <li key={l}>{l}</li>)}
                  </ul>
                </div>
                <div className="mt-3 text-sm">
                  <Link href={`/readiness?event=${event?.event_id ?? ""}`} className="font-medium text-brand-600 hover:underline">Build readiness plan for this event</Link>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="font-medium text-slate-900">{v}</dd>
    </div>
  );
}
