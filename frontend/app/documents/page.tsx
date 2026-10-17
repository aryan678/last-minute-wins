"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTimeLabel, label } from "@/lib/format";
import { Card, ErrorState, Loading } from "@/components/ui";
import type { DocumentRecord } from "@/lib/types";

/** Lists documents across all claims. Upload and review actions live on each claim page. */
export default function DocumentsPage() {
  const claims = useApi(() => api.claims({ page_size: 100 }));
  const docs = useApi(async () => {
    const ids = claims.data?.items.map((c) => c.claim_id) ?? [];
    const lists = await Promise.all(ids.map((id) => api.claimDocuments(id).then((r) => r.items)));
    return lists.flat() as DocumentRecord[];
  }, [claims.data]);

  if (claims.error) return <ErrorState message={claims.error} onRetry={claims.reload} />;
  if (claims.loading || docs.loading || !docs.data) return <Loading label="Loading documents…" />;
  if (docs.error) return <ErrorState message={docs.error} onRetry={docs.reload} />;

  const counts = docs.data.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.processing_status]: (acc[d.processing_status] ?? 0) + 1 }), {});
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Documents & evidence</h1>
        <p className="text-sm text-slate-500">{docs.data.length} documents across all claims. Open a claim to upload or review.</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(counts).map(([k, v]) => <span key={k} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{label(k)}: {v}</span>)}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="py-2 pr-4">File</th><th className="pr-4">Claim</th><th className="pr-4">Type</th><th className="pr-4">Uploaded</th><th className="pr-4">Processing</th><th>Review</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.data.map((d) => (
                <tr key={d.document_id}>
                  <td className="py-2 pr-4 font-medium">{d.file_name}</td>
                  <td className="pr-4"><Link href={`/claims/${d.claim_id}`} className="text-indigo-700 hover:underline">{d.claim_id}</Link></td>
                  <td className="pr-4">{label(d.document_type)}</td>
                  <td className="pr-4 whitespace-nowrap text-xs">{dateTimeLabel(d.uploaded_at)}</td>
                  <td className="pr-4 text-xs">{label(d.processing_status)}</td>
                  <td className="text-xs">{d.review_status === "reviewed" ? "Reviewed" : "Unreviewed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
