"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateLabel, dateTimeLabel, inr, label } from "@/lib/format";
import { Card, Empty, ErrorState, Loading, PriorityBadge, StatusBadge } from "@/components/ui";

const TYPES = ["property_damage", "motor", "fire", "theft", "casualty_liability", "business_interruption", "other"];
const STATUSES = ["FNOL received", "Awaiting documents", "Documents received", "Under review", "Additional evidence required", "Escalated for human review", "Ready for adjuster decision", "Closed"];
const ADJUSTERS = ["ADJ-01", "ADJ-02", "ADJ-03", "ADJ-04", "ADJ-05"];

export default function ClaimsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const router = useRouter();
  const [q, setQ] = useState(searchParams.q ?? "");
  const [search, setSearch] = useState(searchParams.q ?? "");
  const [claimType, setClaimType] = useState(searchParams.claim_type ?? "");
  const [status, setStatus] = useState(searchParams.status ?? "");
  const [priority, setPriority] = useState(searchParams.priority ?? "");
  const [eventId, setEventId] = useState(searchParams.event_id ?? "");
  const [adjusterId, setAdjusterId] = useState(searchParams.adjuster_id ?? "");
  const [sort, setSort] = useState("last_updated");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // Debounce the search box so the API is not called on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(1), [claimType, status, priority, eventId, adjusterId]);

  const claims = useApi(
    () => api.claims({ q: search, claim_type: claimType, status, priority, event_id: eventId, adjuster_id: adjusterId, sort, order, page, page_size: 10 }),
    [search, claimType, status, priority, eventId, adjusterId, sort, order, page],
  );

  const toggleSort = (key: string) => {
    if (sort === key) setOrder(order === "asc" ? "desc" : "asc");
    else { setSort(key); setOrder("desc"); }
  };
  const sortMark = (key: string) => (sort === key ? (order === "asc" ? " ▲" : " ▼") : "");
  const clear = () => { setQ(""); setClaimType(""); setStatus(""); setPriority(""); setEventId(""); setAdjusterId(""); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Claims command center</h1>
          <p className="text-sm text-slate-500">Search, filter and open claims. Priority and status are triage aids, not claim decisions.</p>
        </div>
        <button onClick={clear} className="text-sm font-medium text-brand-600 hover:underline">Clear filters</button>
      </div>

      <Card>
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          <input aria-label="Search claims" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Claim, policy, claimant or region"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm md:col-span-3 xl:col-span-2" />
          <Select label="Claim type" value={claimType} onChange={setClaimType} options={TYPES.map((t) => [t, label(t)])} />
          <Select label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => [s, s])} />
          <Select label="Priority" value={priority} onChange={setPriority} options={[["high", "High"], ["medium", "Medium"], ["low", "Low"]]} />
          <Select label="Event" value={eventId} onChange={setEventId} options={[["SCN-001", "Demo Coastal Cyclone (SIM)"], ["SIM-CYC-2026-01", "Cyclone Meera (SIM)"],["SIM-FLD-2026-02", "Flood watch (SIM)"], ["SIM-FIR-2026-03", "Industrial fire (SIM)"]]} />
          <Select label="Adjuster" value={adjusterId} onChange={setAdjusterId} options={ADJUSTERS.map((a) => [a, a])} />
        </div>
      </Card>

      <Card>
        {claims.loading ? <Loading /> : claims.error ? <ErrorState message={claims.error} onRetry={claims.reload} /> : !claims.data || claims.data.total === 0 ? (
          <Empty message="No claims match these filters. Clear the filters to see all claims." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4"><button onClick={() => toggleSort("claim_id")}>Claim{sortMark("claim_id")}</button></th>
                    <th className="pr-4">Policy</th>
                    <th className="pr-4">Claimant</th>
                    <th className="pr-4">Type</th>
                    <th className="pr-4">Region / location</th>
                    <th className="pr-4 text-right"><button onClick={() => toggleSort("reported_amount")}>Reported{sortMark("reported_amount")}</button></th>
                    <th className="pr-4">Status</th>
                    <th className="pr-4">Adjuster</th>
                    <th className="pr-4"><button onClick={() => toggleSort("reported_date")}>Reported on{sortMark("reported_date")}</button></th>
                    <th className="pr-4 text-center">Missing docs</th>
                    <th className="pr-4">Priority</th>
                    <th><button onClick={() => toggleSort("last_updated")}>Updated{sortMark("last_updated")}</button></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {claims.data.items.map((c) => (
                    <tr key={c.claim_id} tabIndex={0} className="cursor-pointer hover:bg-slate-50 focus:bg-indigo-50 focus:outline-none"
                      onClick={() => router.push(`/claims/${c.claim_id}`)}
                      onKeyDown={(e) => e.key === "Enter" && router.push(`/claims/${c.claim_id}`)}>
                      <td className="py-2 pr-4 font-medium text-indigo-700">{c.claim_id}</td>
                      <td className="pr-4 text-slate-600">{c.policy_id}</td>
                      <td className="pr-4">{c.policyholder}</td>
                      <td className="pr-4">{label(c.claim_type)}</td>
                      <td className="pr-4 text-slate-600">{c.location_label}</td>
                      <td className="pr-4 text-right tabular-nums">{inr(c.reported_amount_inr)}</td>
                      <td className="pr-4"><StatusBadge status={c.status} /></td>
                      <td className="pr-4">{c.adjuster.name ?? c.adjuster.adjuster_id}</td>
                      <td className="pr-4 whitespace-nowrap">{dateLabel(c.reported_date)}</td>
                      <td className="pr-4 text-center">{c.missing_document_count}</td>
                      <td className="pr-4"><PriorityBadge priority={c.priority} /></td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{dateTimeLabel(c.last_updated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>{claims.data.total} claims · page {claims.data.page} of {claims.data.total_pages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border px-3 py-1 disabled:opacity-40">Previous</button>
                <button disabled={page >= claims.data.total_pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border px-3 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Select({ label: text, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <select aria-label={text} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
      <option value="">All {text.toLowerCase()}s</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
