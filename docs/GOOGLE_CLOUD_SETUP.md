# Google Cloud setup

ClaimWise runs in demo mode with no Google Cloud account. Use this guide to turn on real services.

**Status in this build**

| Service | Status | Live code path |
|---|---|---|
| Gemini on Vertex AI | Implemented | Used when `GEMINI_ENABLED=true` and `GOOGLE_CLOUD_PROJECT` is set. Falls back to templates on any failure. Not yet tested against a live project. |
| BigQuery | SQL written, not wired | `infrastructure/bigquery/*.sql`. Exposure is computed in Python. |
| Document AI | Not implemented | Uploads are stored and marked `awaiting_extraction`. No fields are invented. |
| Vertex AI Search | Not implemented | Clause retrieval uses the local DEMO POLICY DATA set. |
| Cloud Storage | Not implemented | Uploads go to local demo storage (`backend/uploads`, git-ignored). |
| Cloud Run | Dockerfile ready | `backend/Dockerfile`. Not deployed from this build. |

## 1. Project and billing

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Use `asia-south1` (Mumbai) for data residency where the hackathon allows it.

## 2. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  bigquery.googleapis.com \
  storage.googleapis.com \
  documentai.googleapis.com \
  discoveryengine.googleapis.com
```

## 3. Service account with least privilege

```bash
gcloud iam service-accounts create claimwise-api --display-name="ClaimWise API"
SA=claimwise-api@YOUR_PROJECT_ID.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:$SA" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:$SA" --role="roles/bigquery.dataViewer"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:$SA" --role="roles/bigquery.jobUser"
```

Add these only when those services are implemented: `roles/storage.objectAdmin` on the upload bucket, `roles/documentai.apiUser`, and `roles/discoveryengine.viewer`.

Do not create or download service account keys. Locally, use Application Default Credentials. On Cloud Run, attach the service account.

```bash
gcloud auth application-default login
```

## 4. Gemini on Vertex AI

Set these variables for the backend (see `backend/.env.example`):

```bash
export GEMINI_ENABLED=true
export GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
export GOOGLE_CLOUD_REGION=asia-south1
export VERTEX_GEMINI_MODEL=gemini-2.5-flash
```

Check that the model is available in your region before the demo. If it is not, change `VERTEX_GEMINI_MODEL`. The Settings page shows whether Gemini is active. Each narrative is labelled `vertex_ai` or `demo_fallback`.

Install the optional SDK: `pip install -r requirements-gcp.txt`.

## 5. BigQuery

```bash
bq --location=asia-south1 mk --dataset YOUR_PROJECT_ID:claimwise
```

Then run `infrastructure/bigquery/schema.sql` with `PROJECT` replaced by your project ID. The exposure query is in `infrastructure/bigquery/exposure.sql`. It has not been run in this build, so check it in the console before the demo.

## 6. Cloud Storage (not yet wired)

```bash
gcloud storage buckets create gs://YOUR_PROJECT_ID-claimwise-uploads --location=asia-south1 --uniform-bucket-level-access
```

Keep the bucket private. Do not grant public access to claim documents.

## 7. Document AI (not yet wired)

Create an Invoice Parser or Form Parser processor in the Document AI console. Note its ID and location. Set `DOCUMENT_AI_PROCESSOR_ID` and `DOCUMENT_AI_LOCATION`. The extraction code is not written yet.

## 8. Vertex AI Search (not yet wired)

Create a data store with the policy wording and claims procedures, then set `VERTEX_SEARCH_DATASTORE_ID`. Until the adapter exists, the app uses DEMO POLICY DATA and labels it as such.

## 9. Deploy the backend to Cloud Run

```bash
cd backend
gcloud run deploy claimwise-api \
  --source . \
  --region asia-south1 \
  --service-account claimwise-api@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars APP_ENV=demo,GEMINI_ENABLED=true,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_REGION=asia-south1,CORS_ALLOWED_ORIGINS=https://YOUR_FRONTEND_URL \
  --allow-unauthenticated
```

Verify the deployment:

```bash
curl https://YOUR_CLOUD_RUN_URL/api/health
```

The response shows which integrations are configured. Cloud Run's in-memory demo data resets when an instance restarts.

## 10. Frontend

Set `NEXT_PUBLIC_API_BASE_URL` to the Cloud Run backend URL, then run `npm run build` and deploy the frontend to Firebase App Hosting or any static host. Never place credentials in frontend variables.
