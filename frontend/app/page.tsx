"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { compactInr, dateTimeLabel, inr, label } from "@/lib/format";
import { Card, DemoBanner, ErrorState, Kpi, Loading, PriorityBadge, StatusBadge } from "@/components/ui";
import type { ClaimRow } from "@/lib/types";

const PALETTE = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

export default function OverviewPage() {
  const overview = useApi(() => api.overview());
  const alerts = useApi(() => api.alerts());
  const claims = useApi(() => api.claims({ page_size: 100, sort: "last_updated", order: "desc" }));
  const analytics = useApi(() => api.analyticsClaims());

  const kpis = overview.data;
  const activeAlert = alerts.data?.items.find((a) => a.status === "active");
  const recent: ClaimRow[] = claims.data?.items.slice(0, 6) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Executive overview</h1>
        <p className="text-sm text-slate-500">Catastrophe exposure and claims workload, with human review for every claim decision.</p>
      </div>

      {kpis && <DemoBanner text={kpis.data_label} />}

      {overview.error ? (
        <ErrorState message={overview.error} onRetry={overview.reload} />
      ) : overview.loading || !kpis ? (
        <Loading label="Loading summary…" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Active alerts" value={String(kpis.active_alerts)} href="/alerts" hint="Simulated" />
          <Kpi label="Policies exposed" value={String(kpis.exposed_policies)} hint="Approximate zone match" href="/alerts" />
          <Kpi label="Insured value exposed" value={compactInr(kpis.insured_value_exposed_inr)} hint={inr(kpis.insured_value_exposed_inr)} />
          <Kpi label="Open claims" value={String(kpis.open_claims)} href="/claims" />
          <Kpi label="Awaiting documents" value={String(kpis.claims_awaiting_documents)} hint="Missing a required item" href="/claims" />
          <Kpi label="Need adjuster review" value={String(kpis.claims_requiring_review)} href="/claims" />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Active catastrophe" subtitle="Simulated scenario. Not an official warning." className="xl:col-span-1"
          action={<Link href="/alerts" className="text-xs font-medium text-brand-600 hover:underline">Open map</Link>}>
          {alerts.loading ? <Loading /> : alerts.error ? <ErrorState message={alerts.error} onRetry={alerts.reload} /> : activeAlert ? (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-slate-900">{activeAlert.name}</p>
              <p className="text-slate-600">{activeAlert.region}</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500">Severity</dt><dd className="font-medium">{activeAlert.severity}</dd>
                <dt className="text-slate-500">Detected</dt><dd>{dateTimeLabel(activeAlert.detected_at)}</dd>
                <dt className="text-slate-500">Impact radius</dt><dd>{activeAlert.radius_km} km</dd>
                <dt className="text-slate-500">Source</dt><dd>{activeAlert.source_name}</dd>
              </dl>
              <p className="pt-1 text-xs text-slate-500">{activeAlert.severity_basis}</p>
            </div>
          ) : <p className="text-sm text-slate-500">No active alert.</p>}
        </Card>

        <Card title="Claims by type" subtitle="All claims in the demo portfolio" className="xl:col-span-1">
          {analytics.loading ? <Loading /> : analytics.error ? <ErrorState message={analytics.error} onRetry={analytics.reload} /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(analytics.data?.by_type ?? []).map((x: any) => ({ name: label(x.claim_type), count: x.count, type: x.claim_type }))} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [v, "Claims"]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {(analytics.data?.by_type ?? []).map((_: unknown, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Claim status" subtitle="Share of claims by workflow status" className="xl:col-span-1">
          {analytics.loading ? <Loading /> : analytics.error ? <ErrorState message={analytics.error} onRetry={analytics.reload} /> : (
            <div className="grid grid-cols-2 items-center gap-2">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={(analytics.data?.by_status ?? []).map((x: any) => ({ name: x.status, value: x.count }))} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                      {(analytics.data?.by_status ?? []).map((_: unknown, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1 text-xs">
                {(analytics.data?.by_status ?? []).map((x: any, i: number) => (
                  <li key={x.status} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="flex-1 truncate">{x.status}</span>
                    <span className="font-medium">{x.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card title="Recent claims" subtitle="Most recently updated. Click a row to open it."
        action={<Link href="/claims" className="text-xs font-medium text-brand-600 hover:underline">View all claims</Link>}>
        {claims.loading ? <Loading /> : claims.error ? <ErrorState message={claims.error} onRetry={claims.reload} /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-2 pr-4">Claim</th><th className="pr-4">Type</th><th className="pr-4 text-right">Reported</th><th className="pr-4">Status</th><th className="pr-4">Priority</th><th>Updated</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((c) => (
                  <tr key={c.claim_id} className="cursor-pointer hover:bg-slate-50" onClick={() => (window.location.href = `/claims/${c.claim_id}`)}>
                    <td className="py-2 pr-4 font-medium text-indigo-700">{c.claim_id}</td>
                    <td className="pr-4">{label(c.claim_type)}</td>
                    <td className="pr-4 text-right tabular-nums">{inr(c.reported_amount_inr)}</td>
                    <td className="pr-4"><StatusBadge status={c.status} /></td>
                    <td className="pr-4"><PriorityBadge priority={c.priority} /></td>
                    <td className="text-xs text-slate-500">{dateTimeLabel(c.last_updated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
