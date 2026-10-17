"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateLabel, dateTimeLabel, inr, label } from "@/lib/format";
import { Card, DemoBanner, Empty, ErrorState, Loading, PriorityBadge, StatusBadge } from "@/components/ui";
import type { Analysis, ChecklistItem, ClaimDetail } from "@/lib/types";

const TABS = [
  ["overview", "Claim overview"],
  ["documents", "Documents & evidence"],
  ["financial", "Financial validation"],
  ["coverage", "Policy coverage"],
  ["summary", "AI summary"],
  ["activity", "Activity & actions"],
] as const;
type Tab = (typeof TABS)[number][0];

const STATUSES = ["FNOL received", "Awaiting documents", "Documents received", "Under review", "Additional evidence required", "Escalated for human review", "Ready for adjuster decision", "Closed"];
const ADJUSTERS = [["ADJ-01", "Sana Qureshi"], ["ADJ-02", "Rajiv Thomas"], ["ADJ-03", "Leela Varma"], ["ADJ-04", "Imran Sheikh"], ["ADJ-05", "Nandini Roy"]];
const UPLOAD_TYPES = ["claim_form", "invoice", "repair_estimate", "photos", "police_report", "fire_report", "vehicle_registration", "proof_of_ownership", "proof_of_payment", "income_statement", "other"];
const ACCEPT = ".pdf,.png,.jpg,.jpeg";
const MAX_MB = 10;

export default function ClaimDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [tab, setTab] = useState<Tab>("overview");
  const claim = useApi(() => api.claim(id), [id]);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const refresh = () => claim.reload();
  const notify = (kind: "ok" | "err", text: string) => setFlash({ kind, text });

  if (claim.error) {
    return (
      <div className="space-y-4">
        <Link href="/claims" className="text-sm text-brand-600 hover:underline">← Back to claims</Link>
        <ErrorState message={claim.error} onRetry={claim.reload} />
      </div>
    );
  }
  if (claim.loading || !claim.data) return <Loading label="Loading claim…" />;
  const c = claim.data;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/claims" className="text-sm text-brand-600 hover:underline">← Back to claims</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{c.claim_id}</h1>
          <StatusBadge status={c.status} />
          <PriorityBadge priority={c.priority} />
          <span className="text-sm text-slate-500">{c.policyholder} · {label(c.claim_type)} · {inr(c.reported_amount_inr)}</span>
        </div>
      </div>

      <DemoBanner text="DEMO DATA. AI and checks support the adjuster. They do not approve, reject or determine fraud." />

      {flash && (
        <div role="status" className={`rounded-md px-3 py-2 text-sm ${flash.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {flash.text}
          <button className="ml-3 text-xs underline" onClick={() => setFlash(null)}>Dismiss</button>
        </div>
      )}

      <div role="tablist" aria-label="Claim sections" className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(([key, text]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === key ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {text}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab c={c} />}
      {tab === "documents" && <DocumentsTab claim={c} onChange={refresh} notify={notify} />}
      {tab === "financial" && <FinancialTab claimId={id} />}
      {tab === "coverage" && <CoverageTab claimId={id} />}
      {tab === "summary" && <SummaryTab claimId={id} />}
      {tab === "activity" && <ActivityTab claim={c} onChange={refresh} notify={notify} />}
    </div>
  );
}

function Fields({ rows }: { rows: [string, string | number | null | undefined][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="text-sm font-medium text-slate-900">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function OverviewTab({ c }: { c: ClaimDetail }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Claim">
        <Fields rows={[
          ["Claim ID", c.claim_id], ["Policy ID", c.policy_id], ["Policyholder", c.policyholder],
          ["Claim category", label(c.claim_type)], ["Loss cause", label(c.loss_cause)],
          ["Loss date", dateLabel(c.loss_date)], ["Reported date", dateLabel(c.reported_date)],
          ["Incident location", c.incident_location], ["Reported loss", inr(c.reported_amount_inr)],
          ["Policy limit", inr(c.policy.coverage_limit_inr)], ["Deductible", inr(c.policy.deductible_inr)],
          ["Assigned adjuster", c.adjuster.name ?? c.adjuster.adjuster_id], ["Current status", c.status],
          ["Last updated", dateTimeLabel(c.last_updated)],
        ]} />
      </Card>
      <Card title="Policy and event" subtitle="Relevant catastrophe event">
        <Fields rows={[
          ["Policy type", c.policy.policy_type], ["Insured item", c.policy.insured_item],
          ["Policy period", `${dateLabel(c.policy.effective_from)} to ${dateLabel(c.policy.effective_to)}`],
          ["Covered perils", c.policy.covered_perils.map(label).join(", ")],
          ["Linked event", c.event ? (c.event.is_simulated && !c.event.name.includes("SIMULATED") ? `${c.event.name} (SIMULATED)` : c.event.name) : "None linked"],
        ]} />
        <p className="mt-3 text-xs text-slate-500">Being in an affected area does not establish that property was damaged or that the loss is covered.</p>
      </Card>
    </div>
  );
}

function DocumentsTab({ claim, onChange, notify }: { claim: ClaimDetail; onChange: () => void; notify: (k: "ok" | "err", t: string) => void }) {
  const docs = useApi(() => api.claimDocuments(claim.claim_id), [claim.claim_id]);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("invoice");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "png", "jpg", "jpeg"].includes(ext)) return setError("Only PDF, PNG, JPG and JPEG files are accepted.");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`The file is larger than ${MAX_MB} MB.`);
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await api.uploadDocument(claim.claim_id, file, docType);
      notify("ok", `Uploaded ${file.name}. It is stored but not yet extracted, because Document AI is not configured.`);
      setFile(null);
      docs.reload();
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const requestEvidence = async (item: ChecklistItem) => {
    try {
      await api.addNote(claim.claim_id, { text: `Requested ${label(item.document_type)} from the claimant.`, kind: "evidence_requested", document_type: item.document_type });
      notify("ok", `Requested ${label(item.document_type)}. Logged in the activity log.`);
      onChange();
    } catch (e) {
      notify("err", e instanceof ApiError ? e.message : "Could not record the request.");
    }
  };

  const markReviewed = async (docId: string) => {
    try {
      await api.patchDocument(docId, { review_status: "reviewed" });
      docs.reload();
    } catch (e) {
      notify("err", e instanceof ApiError ? e.message : "Could not update the document.");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card title="Document checklist" subtitle="Required items depend on the claim category." className="xl:col-span-2">
        <ul className="divide-y divide-slate-100">
          {claim.checklist.map((item) => (
            <li key={item.document_type} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{label(item.document_type)}</p>
                <p className="text-xs text-slate-500">{item.why_needed}</p>
              </div>
              <div className="flex items-center gap-2">
                <ChecklistBadge status={item.status} />
                {item.requested && <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">Requested</span>}
                {(item.status === "missing" || item.status === "extraction_failed") && !item.requested && (
                  <button onClick={() => requestEvidence(item)} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Mark as requested</button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Received, missing, needs review and extraction failed are based on uploaded records. Missing items are not proof the claimant has not sent them.</p>
      </Card>

      <Card title="Upload evidence" subtitle={`PDF, PNG, JPG or JPEG, up to ${MAX_MB} MB`}>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-slate-500">Document type</span>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2">
              {UPLOAD_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">File</span>
            <input type="file" accept={ACCEPT} aria-label="Choose file" onChange={(e) => pick(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
          </label>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <button disabled={!file || busy} onClick={upload} className="w-full rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40">
            {busy ? "Uploading…" : "Upload document"}
          </button>
        </div>
      </Card>

      <Card title="Uploaded documents" className="xl:col-span-3">
        {docs.loading ? <Loading /> : docs.error ? <ErrorState message={docs.error} onRetry={docs.reload} /> : !docs.data || docs.data.items.length === 0 ? (
          <Empty message="No documents yet for this claim." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-2 pr-4">File</th><th className="pr-4">Type</th><th className="pr-4">Uploaded</th><th className="pr-4">Processing</th><th className="pr-4">Extracted fields</th><th className="pr-4">Confidence</th><th className="pr-4">Review</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docs.data.items.map((d) => (
                  <tr key={d.document_id} className="align-top">
                    <td className="py-2 pr-4 font-medium">{d.file_name}<div className="text-xs font-normal text-slate-400">{d.document_id}</div></td>
                    <td className="pr-4">{label(d.document_type)}</td>
                    <td className="pr-4 whitespace-nowrap text-xs">{dateTimeLabel(d.uploaded_at)}</td>
                    <td className="pr-4 text-xs">{label(d.processing_status)}</td>
                    <td className="pr-4 text-xs">
                      {Object.keys(d.extracted_fields).length === 0 ? <span className="text-slate-400">None extracted</span> : (
                        <ul className="space-y-0.5">
                          {Object.entries(d.extracted_fields).filter(([k]) => k !== "line_items").map(([k, v]) => (
                            <li key={k}><span className="text-slate-500">{label(k)}:</span> {typeof v === "number" ? inr(v) : String(v ?? "—")}</li>
                          ))}
                        </ul>
                      )}
                      {d.extraction_source === "demo_seed" && <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-800">DEMO SAMPLE</span>}
                    </td>
                    <td className="pr-4 text-xs">{d.extraction_confidence !== null ? `${Math.round(d.extraction_confidence * 100)}%` : "—"}</td>
                    <td className="pr-4 text-xs">{d.review_status === "reviewed" ? "Reviewed" : "Unreviewed"}</td>
                    <td className="text-right">
                      {d.review_status !== "reviewed" && <button onClick={() => markReviewed(d.document_id)} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50">Mark reviewed</button>}
                    </td>
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

function ChecklistBadge({ status }: { status: ChecklistItem["status"] }) {
  const map: Record<ChecklistItem["status"], [string, string]> = {
    received: ["Received", "bg-emerald-50 text-emerald-800"],
    missing: ["Missing", "bg-red-50 text-red-800"],
    needs_review: ["Needs review", "bg-amber-50 text-amber-900"],
    extraction_failed: ["Extraction failed", "bg-orange-50 text-orange-800"],
  };
  const [text, cls] = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}

function FinancialTab({ claimId }: { claimId: string }) {
  const analysis = useApi<Analysis>(() => api.analyze(claimId), [claimId]);
  if (analysis.loading) return <Loading label="Running deterministic checks…" />;
  if (analysis.error) return <ErrorState message={analysis.error} onRetry={analysis.reload} />;
  const a = analysis.data!;
  return (
    <div className="space-y-5">
      <Card title="Amount checks" subtitle="Deterministic arithmetic. A mismatch is a discrepancy for investigation, not proof of fraud."
        action={<button onClick={analysis.reload} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50">Re-run checks</button>}>
        {a.money_checks.checks.length === 0 ? <Empty message="No amount checks available." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-2 pr-4">Check</th><th className="pr-4 text-right">Claim value</th><th className="pr-4 text-right">Compared value</th><th className="pr-4 text-right">Difference</th><th className="pr-4">Result</th><th className="pr-4">Explanation</th><th>Next action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {a.money_checks.checks.map((c, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4">{label(c.check)}<div className="text-xs text-slate-400">{c.evidence_source}</div></td>
                    <td className="pr-4 text-right tabular-nums">{inr(c.claim_value_inr)}</td>
                    <td className="pr-4 text-right tabular-nums">{inr(c.compared_value)}</td>
                    <td className="pr-4 text-right tabular-nums">{inr(c.difference_inr)}</td>
                    <td className="pr-4"><ResultPill status={c.status} /></td>
                    <td className="pr-4 text-xs">{c.message}{c.confidence !== null && <div className="text-slate-400">Extraction confidence {Math.round(c.confidence * 100)}%</div>}</td>
                    <td className="text-xs">{c.suggested_next_action ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Illustrative payout" subtitle="Simplified. Not a settlement amount.">
          {a.money_checks.illustrative_calculation ? (
            <div className="space-y-2 text-sm">
              <p className="text-xs font-semibold text-amber-800">{a.money_checks.illustrative_calculation.label}</p>
              <p>Basis (supplier total capped at limit): <b>{inr(a.money_checks.illustrative_calculation.basis_inr)}</b></p>
              <p>Less flat deductible: <b>{inr(a.money_checks.illustrative_calculation.deductible_inr)}</b></p>
              <p>Illustrative result: <b>{inr(a.money_checks.illustrative_calculation.result_inr)}</b></p>
              <ul className="list-disc pl-5 text-xs text-slate-500">{a.money_checks.illustrative_calculation.assumptions.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ) : <p className="text-sm text-slate-500">Not shown. A supplier total and a deductible are needed.</p>}
        </Card>
        <Card title="Policy period and peril">
          <ul className="space-y-2 text-sm">
            <li><ResultPill status={a.period_check.status === "active" ? "match" : a.period_check.status === "outside_period" ? "discrepancy" : "unknown"} /> <span className="ml-2">{a.period_check.message}</span></li>
            <li><ResultPill status={a.event_match.status === "listed" ? "match" : "review"} /> <span className="ml-2">{a.event_match.message}</span></li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">{a.decision_status}</p>
        </Card>
      </div>
    </div>
  );
}

function ResultPill({ status }: { status: string }) {
  const good = ["match", "within", "active", "listed"].includes(status);
  const bad = ["exceeds", "discrepancy", "invalid", "outside_period"].includes(status);
  const cls = good ? "bg-emerald-50 text-emerald-800" : bad ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900";
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label(status)}</span>;
}

function CoverageTab({ claimId }: { claimId: string }) {
  const cov = useApi(() => api.coverage(claimId), [claimId]);
  if (cov.loading) return <Loading label="Retrieving policy clauses…" />;
  if (cov.error) return <ErrorState message={cov.error} onRetry={cov.reload} />;
  const r = cov.data!;
  const groups: [string, string, typeof r.groups.potentially_covered][] = [
    ["potentially_covered", "Potentially covered based on supplied wording", r.groups.potentially_covered],
    ["potentially_excluded_or_restricted", "Potentially excluded or restricted", r.groups.potentially_excluded_or_restricted],
    ["needs_human_review", "Needs human review", r.groups.needs_human_review],
  ];
  return (
    <div className="space-y-5">
      <DemoBanner text={r.label} />
      <Card title="Coverage status" subtitle={r.decision_note}>
        <p className="text-sm font-semibold text-slate-900">Coverage decision: Not determined</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>{r.period_check.message}</li>
          <li>{r.peril_check.message}</li>
        </ul>
      </Card>
      <div className="grid gap-5 xl:grid-cols-3">
        {groups.map(([key, title, items]) => (
          <Card key={key} title={title} subtitle={`${items.length} clause(s)`}>
            {items.length === 0 ? <Empty message="No clauses in this group." /> : (
              <ul className="space-y-3">
                {items.map((c, i) => (
                  <li key={`${c.clause_id}-${i}`} className="rounded-md border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">{c.heading}</p>
                    <p className="mt-1 text-slate-700">{c.text}</p>
                    <p className="mt-2 text-xs text-slate-500">Source: {c.source}{c.clause_id ? ` (${c.clause_id})` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
      {r.missing_information.length > 0 && (
        <Card title="Information missing for interpretation">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{r.missing_information.map((m) => <li key={m}>{m}</li>)}</ul>
        </Card>
      )}
    </div>
  );
}

function SummaryTab({ claimId }: { claimId: string }) {
  const s = useApi(() => api.summary(claimId), [claimId]);
  if (s.loading) return <Loading label="Building summary…" />;
  if (s.error) return <ErrorState message={s.error} onRetry={s.reload} />;
  const d = s.data!;
  const sec = d.structured_summary;
  const rows: [string, string[]][] = [
    ["Documents received", sec.documents_received.map(label)],
    ["Documents missing", sec.documents_missing.map(label)],
    ["Documents needing review", sec.documents_needing_review.map(label)],
    ["Financial discrepancies", sec.financial_discrepancies],
    ["Potentially relevant provisions", sec.potentially_relevant_provisions],
    ["Exclusions or restrictions", sec.exclusions_or_restrictions],
    ["Uncertainties", sec.uncertainties],
    ["Recommended next steps", sec.recommended_next_steps],
    ["Needs an adjuster's decision", sec.adjuster_decision_required],
  ];
  return (
    <div className="space-y-5">
      <Card title="Claim summary" subtitle="Built from verified record facts. Coverage and amounts are not decided by AI.">
        <p className="text-sm text-slate-800">{sec.what_happened}</p>
        <p className="mt-2 text-sm text-slate-800">Claimed loss: <b>{inr(sec.claimed_loss_inr)}</b></p>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
              <dd>{v.length ? <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{v.map((x) => <li key={x}>{x}</li>)}</ul> : <span className="text-sm text-slate-400">None</span>}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Narrative" subtitle={d.ai_narrative.source === "vertex_ai" ? `Generated by ${d.ai_narrative.model} on Vertex AI` : "DEMO FALLBACK: template text. Vertex AI is not in use."}>
        <p className="text-sm text-slate-800">{d.ai_narrative.text}</p>
        {d.ai_narrative.fallback_reason && <p className="mt-2 text-xs text-slate-500">Fallback reason: {d.ai_narrative.fallback_reason}</p>}
        <p className="mt-3 text-xs font-semibold text-slate-600">{d.decision_status}</p>
      </Card>
    </div>
  );
}

function ActivityTab({ claim, onChange, notify }: { claim: ClaimDetail; onChange: () => void; notify: (k: "ok" | "err", t: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); notify("ok", ok); onChange(); }
    catch (e) { notify("err", e instanceof ApiError ? e.message : "Action failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card title="Next actions" subtitle="Each action is saved to the activity log.">
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-slate-500">Workflow status</span>
            <select value={claim.status} disabled={busy} onChange={(e) => act(() => api.patchClaim(claim.claim_id, { status: e.target.value }), `Status set to ${e.target.value}.`)}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Assigned adjuster</span>
            <select value={claim.adjuster.adjuster_id} disabled={busy} onChange={(e) => act(() => api.patchClaim(claim.claim_id, { adjuster_id: e.target.value }), "Adjuster assigned.")}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2">
              {ADJUSTERS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <button disabled={busy} onClick={() => act(() => api.addNote(claim.claim_id, { text: "Review completed by adjuster.", kind: "review_completed" }), "Review recorded.")}
            className="w-full rounded-md border px-3 py-2 hover:bg-slate-50 disabled:opacity-40">Record review completed</button>
        </div>
      </Card>

      <Card title="Adjuster note" className="xl:col-span-1">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={4} placeholder="Add a note for the claim file"
          className="w-full rounded-md border border-slate-200 p-2 text-sm" />
        <button disabled={busy || !note.trim()} onClick={() => act(async () => { await api.addNote(claim.claim_id, { text: note.trim() }); setNote(""); }, "Note added.")}
          className="mt-2 w-full rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40">Add note</button>
      </Card>

      <Card title="Activity log" className="xl:col-span-3" subtitle="Newest first. Entries are kept for the running demo only.">
        {claim.activity.length === 0 ? <Empty message="No activity recorded yet." /> : (
          <ol className="space-y-2 text-sm">
            {[...claim.activity].reverse().map((a, i) => (
              <li key={i} className="flex gap-3 border-b border-slate-100 pb-2">
                <span className="w-36 shrink-0 text-xs text-slate-500">{dateTimeLabel(a.at)}</span>
                <span className="flex-1">{a.text}</span>
                <span className="text-xs text-slate-400">{a.actor}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
