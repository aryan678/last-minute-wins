"use client";

import { API_BASE, api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, DemoBanner, ErrorState, Loading, StatusBadge } from "@/components/ui";

export default function SettingsPage() {
  const health = useApi(() => api.health());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings and integrations</h1>
        <p className="text-sm text-slate-500">Which Google Cloud services are live and which run in demo mode.</p>
      </div>
      <DemoBanner text="Live services are used only when configured on the backend. Otherwise the labelled demo path runs." />
      <Card title="Connection">
        <p className="text-sm">API base URL: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{API_BASE}</code></p>
      </Card>
      <Card title="Google Cloud integrations">
        {health.loading ? <Loading /> : health.error ? <ErrorState message={health.error} onRetry={health.reload} /> : (
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="py-2 pr-4">Service</th><th className="pr-4">Mode</th><th className="pr-4">Implemented in this build</th><th>Note</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {health.data!.integrations.map((i) => (
                <tr key={i.service}>
                  <td className="py-2 pr-4 font-medium">{i.service}</td>
                  <td className="pr-4"><StatusBadge status={i.configured ? "Under review" : "Closed"} /> <span className="ml-1 text-xs">{i.mode ?? (i.configured ? "vertex_ai" : "demo_fallback")}</span></td>
                  <td className="pr-4 text-xs">{i.implemented ? "Yes" : "No"}</td>
                  <td className="text-xs text-slate-600">{i.note ?? "Connected."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
