# Architecture

```
Next.js frontend (App Router, Tailwind, Leaflet, Recharts)
   │  typed client: frontend/lib/api.ts
   ▼
FastAPI backend (backend/app)
   ├─ api/routes.py          thin HTTP layer, Pydantic validation
   ├─ services/              business logic
   │   ├─ exposure.py        radius match, distinct policy count, insured value
   │   ├─ claims.py          document checklist, amount checks, policy period/peril
   │   ├─ coverage.py        clause retrieval and grouping (demo clause set)
   │   ├─ summary.py         deterministic summary + AI narrative
   │   ├─ readiness.py       workload assumptions, tasks
   │   ├─ ai.py              Gemini on Vertex AI with template fallback
   │   ├─ documents.py       upload validation and storage
   │   ├─ analytics.py       portfolio and claims metrics
   │   └─ integrations.py    health/status of each Google Cloud service
   └─ store.py               in-memory demo store loaded from data/seed.json
```

## Rules the design enforces

1. **Deterministic code does the arithmetic.** Totals, limits, deductibles, dates, exposure counts and document completeness are computed in Python. Gemini only writes text from those verified facts.
2. **AI never decides.** Every claim response carries `decision_status`. Coverage returns `coverage_decision: not_determined`.
3. **Fallbacks are labelled.** Each service reports `demo_fallback`, `vertex_ai` or `not_implemented`. The UI shows the label. Nothing silently replaces a failed live response.
4. **No double counting.** A policy with several locations inside one zone is counted once.
5. **Uploads are untrusted.** Files are checked for extension, size and magic bytes. Stored under generated names. Document text is never treated as instructions.

## Google Cloud mapping

| Need | Target service | Build status |
|---|---|---|
| Analytics | BigQuery | SQL written. Python computes the same results in demo mode |
| Narrative | Gemini on Vertex AI | Implemented, with fallback |
| Extraction | Document AI | Not implemented |
| Policy search | Vertex AI Search | Not implemented |
| Document storage | Cloud Storage | Not implemented. Local demo storage |
| Hosting | Cloud Run | Dockerfile ready |

## Data

`backend/app/data/seed.json` holds 3 events, 20 policies, 22 insured locations, 15 claims, 5 adjusters, 30 documents, 10 clauses and the workload assumptions. All records are fictional and labelled as demo data.
