# API reference

Base URL: `http://localhost:8000`. Interactive docs: `http://localhost:8000/docs`.

All responses are JSON. Errors use `{"detail": "message"}` with a proper HTTP status (404 unknown ID, 422 invalid input).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Service status and integration modes |
| GET | `/api/overview` | Dashboard KPIs, computed from the data |
| GET | `/api/alerts` | Catastrophe alerts. Filters: `status`, `hazard_type` |
| GET | `/api/alerts/{alert_id}` | One alert |
| GET | `/api/alerts/{alert_id}/exposure` | Exposed policies, locations and insured value, with by-product and by-zone breakdowns |
| GET | `/api/claims` | Paged claims. Filters: `q`, `claim_type`, `status`, `priority`, `event_id`, `adjuster_id`. Sort: `sort`, `order`. Paging: `page`, `page_size` (max 100) |
| GET | `/api/claims/{claim_id}` | Claim, policy, event, document checklist, activity log, notes |
| GET | `/api/claims/{claim_id}/documents` | Documents for a claim, plus the checklist |
| POST | `/api/claims/{claim_id}/documents` | Upload. Form fields: `file`, `document_type`. PDF, PNG, JPG, JPEG; max `MAX_UPLOAD_MB` |
| POST | `/api/claims/{claim_id}/analyze` | Runs deterministic checks: amounts, policy limit, policy period, peril, document completeness |
| GET | `/api/claims/{claim_id}/summary` | Verified facts, structured summary, and an AI narrative (or demo fallback) |
| GET | `/api/claims/{claim_id}/coverage` | Clauses grouped into covered, excluded or restricted, and needs human review. Labelled DEMO POLICY DATA |
| POST | `/api/claims/{claim_id}/notes` | Add a note. `kind`: `note`, `evidence_requested` (needs `document_type`), `evidence_received`, `review_completed` |
| PATCH | `/api/claims/{claim_id}` | Change `status` or `adjuster_id` |
| PATCH | `/api/documents/{document_id}` | Set `review_status` to `reviewed` or `unreviewed` |
| GET | `/api/analytics/exposure` | Exposure by event |
| GET | `/api/analytics/claims` | Claims by type, status, adjuster; average loss; document completion |
| POST | `/api/readiness-plan` | Create a readiness plan for an alert. Body: `{"event_id": "..."}` |
| GET | `/api/readiness-plan/{plan_id}` | Read a plan |
| PATCH | `/api/readiness-plan/tasks/{task_id}` | Update task `status` or add a `note` |

## Status values

Claim statuses: `FNOL received`, `Awaiting documents`, `Documents received`, `Under review`, `Additional evidence required`, `Escalated for human review`, `Ready for adjuster decision`, `Closed`.

Check statuses: `match`, `discrepancy`, `invalid`, `exceeds`, `within`. These are discrepancies for investigation, not fraud findings.

## Notes on behaviour

- Changes are stored in memory and reset when the server restarts.
- `decision_status` is always "No decision. Human adjuster review required." ClaimWise never approves or rejects a claim.
- The AI narrative field is `ai_narrative.source`: `vertex_ai` or `demo_fallback`.
