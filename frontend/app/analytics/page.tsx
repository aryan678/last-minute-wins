"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { compactInr, inr, label } from "@/lib/format";
import { Card, DemoBanner, ErrorState, Kpi, Loading } from "@/components/ui";

const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

export default function AnalyticsPage() {
  const claims = useApi(() => api.analyticsClaims());
  const exposure = useApi(() => api.analyticsExposure());

  if (claims.error) return <ErrorState message={claims.error} onRetry={claims.reload} />;
  if (claims.loading || !claims.data) return <Loading label="Loading analytics…" />;
  const c = claims.data;
  const e = exposure.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Exposure analytics</h1>
        <p className="text-sm text-slate-500">Portfolio exposure and claims workload. Exposed insured value is not realised loss or expected payout.</p>
      </div>
      <DemoBanner text={c.data_label} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Claims awaiting evidence" value={String(c.claims_awaiting_evidence)} />
        <Kpi label="Document completion" value={c.document_completion_rate === null ? "—" : `${Math.round(c.document_completion_rate * 100)}%`} hint="Required items received" />
        <Kpi label="Linked to active events" value={String(c.claims_linked_to_active_events)} />
        <Kpi label="Documents on file" value={String(c.documents_total)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Exposure by catastrophe" subtitle="Insured value in each event's approximate zone">
          {!e ? <Loading /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={e.by_event.map((x: any) => ({ name: x.name.replace(/\s*\(SIMULATED\)/, ""), value: x.insured_value_inr, policies: x.exposed_policies }))} margin={{ left: 10 }}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => compactInr(v)} tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: number, _n, p: any) => [`${inr(v)} · ${p.payload.policies} policies`, "Insured value"]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {e.by_event.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Average reported loss by claim type">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.average_reported_loss_by_type.map((x: any) => ({ name: label(x.claim_type), avg: x.average_inr }))} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(v) => compactInr(v)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [inr(v), "Average"]} />
                <Bar dataKey="avg" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Claims by adjuster" subtitle="Open claims per adjuster">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.workload_by_adjuster.map((x: any) => ({ name: x.name, open: x.open_claims }))}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="open" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Exposure detail by event">
          {!e ? <Loading /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="py-2 pr-3">Event</th><th className="pr-3 text-right">Policies</th><th className="pr-3 text-right">Locations</th><th className="text-right">Insured value</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {e.by_event.map((x: any) => (
                    <tr key={x.event_id}>
                      <td className="py-2 pr-3">{x.name}<div className="text-xs text-slate-400">{x.status}</div></td>
                      <td className="pr-3 text-right">{x.exposed_policies}</td>
                      <td className="pr-3 text-right">{x.exposed_locations}</td>
                      <td className="text-right tabular-nums">{inr(x.insured_value_inr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
