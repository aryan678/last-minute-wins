ClaimWise AI
AI-powered catastrophe alerts and insurance claims intelligence, built with Google Cloud.

## Run the MVP locally (demo mode, no Google Cloud account needed)

Backend (FastAPI, Python 3.10+):

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

Frontend (Next.js):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. Tests and build:

```bash
cd backend && .venv/bin/python -m pytest -q
cd frontend && npm run build
```

Docs: [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Google Cloud setup](docs/GOOGLE_CLOUD_SETUP.md) · [Demo script](docs/DEMO_SCRIPT.md)

### What is live and what is demo

| Google Cloud service | Status in this build |
|---|---|
| Gemini on Vertex AI | Implemented. Live when `GEMINI_ENABLED=true` and a project is set. Otherwise a labelled template fallback |
| BigQuery | Exposure SQL written. Analytics computed in Python |
| Document AI | Not implemented. Uploads are stored and not extracted |
| Vertex AI Search | Not implemented. Clauses come from the labelled DEMO POLICY DATA set |
| Cloud Storage | Not implemented. Local demo storage |
| Cloud Run | Dockerfile ready. Not deployed from this build |

Synthetic data only. Simulated events are not official warnings. ClaimWise never approves, rejects or declares fraud on a claim.
ClaimWise AI helps insurers connect catastrophe alerts to their insured portfolio, prepare for a surge in claims, and review claim documents against policy wording. It brings catastrophe exposure, claims operations, document checks, and policy evidence into one workflow.
What it does
- Catastrophe alerts: Shows the event type, affected area, severity, timestamp, and source. Hackathon scenarios are clearly labelled as simulated.
- Portfolio exposure: Matches the hazard area with insured properties and policies to estimate exposed policy count and insured value.
- Claims command center: Groups incoming claims by type, such as property damage, motor, fire, theft, and casualty/liability, with status and reported amount.
- Mitigation and readiness: Uses Gemini on Vertex AI to suggest customer outreach, adjuster preparation, and claim-handling priorities based on calculated results and visible assumptions.
- Claim document review: Uses Document AI to extract fields from sample invoices or repair estimates, then checks totals, policy limits, deductibles, and missing documents.
- Policy coverage lookup: Uses Vertex AI Search to retrieve relevant policy clauses and exclusions, with source references where available.
- Claim summary: Produces a concise summary of the reported loss, received documents, amount checks, missing evidence, potential coverage considerations, and suggested next steps.
Google Cloud stack
- BigQuery: Portfolio and claims analytics, exposure calculations, workload estimates.
- Gemini on Vertex AI: Readiness plans and grounded claim summaries.
- Document AI: Claim document extraction.
- Vertex AI Search: Retrieval of policy wording, exclusions, endorsements, and claims procedures.
- Cloud Run: Hosting the API/application.
- Cloud Storage: Uploaded claim documents and sample files.
- Optional: Pub/Sub for alert-triggered workflows; Cloud SQL or AlloyDB if a transactional store is needed.
App stack
- Next.js, React, TypeScript, Tailwind CSS
- Leaflet or MapLibre for the map
- Python FastAPI for APIs
- BigQuery for analytics
- JSON/CSV synthetic data for the MVP
Workflow
1. Select or receive a catastrophe alert.
2. Display its severity, source, timestamp, and affected area.
3. Match the impact area to insured policies in BigQuery.
4. Show exposed policies and incoming claims by claim type.
5. Generate a mitigation/readiness plan with Gemini on Vertex AI.
6. Upload a claim document to Cloud Storage.
7. Extract document fields with Document AI and compare them with claim/policy data using deterministic checks.
8. Retrieve policy clauses with Vertex AI Search.
9. Generate a claim summary that highlights missing evidence, amount mismatches, and potential coverage/exclusion considerations.
10. Leave final claim decisions to a human adjuster.
Data
The hackathon demo uses fictional synthetic data: catastrophe scenarios, policies, insured locations, claims, policy wording, and sample document metadata. See ClaimWise_Dummy_Data_Starter.json for starter examples. Do not use real personal or policy data without permission.
Important limitations
- Simulated alerts are not official warnings.
- Exposure to a hazard does not prove damage or coverage.
- Coverage depends on actual policy wording, endorsements, facts, and evidence.
- The app provides decision support; it does not automatically approve or reject claims or declare fraud.
Team work split
- Frontend and integration: map, alert UI, claims dashboard, claim upload/detail, API connection.
- Backend and analytics: FastAPI, BigQuery, exposure calculations, claim filters, money checks, workload estimates.
- AI and documents: Gemini on Vertex AI, Document AI, Vertex AI Search, grounded summaries and readiness plans.
Project pitch
ClaimWise AI helps insurers move from catastrophe awareness to claims readiness and evidence-based claim review, using Google Cloud AI and analytics.
