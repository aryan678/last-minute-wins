# Demo script (about 3 minutes)

Start both servers first (see the README). Open `http://localhost:3000`.

1. **Overview (20 s).** Show the KPIs and the active simulated cyclone. Say the data is synthetic and the event is simulated, not an official warning.
2. **Catastrophe Intelligence (40 s).** Open the map. Select Cyclone Meera. Point out the dashed impact circle, the severe and outer zones, and the insured locations inside. Read out exposed policies and insured value. Note the limitations: an area match is not proof of damage.
3. **Claims Command Center (25 s).** Filter by Property damage, then open CLM-2001.
4. **Documents (25 s).** Show the checklist: the final invoice is missing. Upload a PDF to show validation. Say it is stored, not extracted, because Document AI is not connected.
5. **Financial validation (25 s).** Open the tab. Show the repair estimate total (₹4,12,500) against the reported ₹4,80,000 as a discrepancy for investigation.
6. **Policy coverage (20 s).** Show the three groups: potentially covered, potentially excluded or restricted, and needs human review. Point out the DEMO POLICY DATA label and "coverage decision: not determined".
7. **AI summary (15 s).** Show the structured summary and the narrative. Say whether it came from Vertex AI or the demo fallback.
8. **Readiness Planner (20 s).** Generate the plan. Show the workload assumptions, the owners and due dates. Update one task status.
9. **Close (10 s).** Say the adjuster makes the final decision, and name the Google Cloud services that are live in this build (see the Settings page).

## Things to say honestly

- Gemini runs live only when configured. Otherwise the narrative shows a DEMO FALLBACK label.
- BigQuery, Document AI, Vertex AI Search and Cloud Storage are not connected in this build.
- Changes reset when the server restarts.
