// Single typed client for the backend. Components never call fetch directly.
import type {
  Analysis, AlertEvent, Clause, ClaimDetail, ClaimRow, ClaimSummary, CoverageReview, DocumentRecord,
  Exposure, Health, Overview, Page, ReadinessPlan, ReadinessTask,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(`Cannot reach the ClaimWise API at ${API_BASE}. Start the backend and try again.`, 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body && typeof body.detail === "string" ? body.detail : `Request failed with status ${res.status}.`;
    throw new ApiError(detail, res.status);
  }
  return body as T;
}

const json = (method: string, payload: unknown): RequestInit => ({ method, body: JSON.stringify(payload) });

export const api = {
  health: () => request<Health>("/api/health"),
  overview: () => request<Overview>("/api/overview"),
  alerts: () => request<{ items: AlertEvent[]; total: number }>("/api/alerts"),
  alertExposure: (id: string) => request<Exposure>(`/api/alerts/${encodeURIComponent(id)}/exposure`),
  claims: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && qs.set(k, String(v)));
    return request<Page<ClaimRow>>(`/api/claims?${qs.toString()}`);
  },
  claim: (id: string) => request<ClaimDetail>(`/api/claims/${encodeURIComponent(id)}`),
  claimDocuments: (id: string) =>
    request<{ items: DocumentRecord[]; total: number }>(`/api/claims/${encodeURIComponent(id)}/documents`),
  uploadDocument: (id: string, file: File, documentType: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", documentType);
    return request<DocumentRecord>(`/api/claims/${encodeURIComponent(id)}/documents`, { method: "POST", body: form });
  },
  analyze: (id: string) => request<Analysis>(`/api/claims/${encodeURIComponent(id)}/analyze`, { method: "POST" }),
  summary: (id: string) => request<ClaimSummary>(`/api/claims/${encodeURIComponent(id)}/summary`),
  coverage: (id: string) => request<CoverageReview>(`/api/claims/${encodeURIComponent(id)}/coverage`),
  addNote: (id: string, body: { text: string; kind?: string; document_type?: string }) =>
    request(`/api/claims/${encodeURIComponent(id)}/notes`, json("POST", body)),
  patchClaim: (id: string, body: { status?: string; adjuster_id?: string }) =>
    request<ClaimRow>(`/api/claims/${encodeURIComponent(id)}`, json("PATCH", body)),
  patchDocument: (id: string, body: { review_status: "unreviewed" | "reviewed" }) =>
    request<DocumentRecord>(`/api/documents/${encodeURIComponent(id)}`, json("PATCH", body)),
  analyticsClaims: () => request<any>("/api/analytics/claims"),
  analyticsExposure: () => request<any>("/api/analytics/exposure"),
  createPlan: (eventId: string) => request<ReadinessPlan>("/api/readiness-plan", json("POST", { event_id: eventId })),
  patchTask: (id: string, body: { status?: string; note?: string }) =>
    request<ReadinessTask>(`/api/readiness-plan/tasks/${encodeURIComponent(id)}`, json("PATCH", body)),
};

export type { Clause };
