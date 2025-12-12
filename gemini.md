This is a comprehensive overview of the Balloon data architecture and technical considerations. You can use this content for your gemini.md or system instructions to help the model reason about the data.

## 1. Core Data Models (src/types/index.ts)
The application revolves around the `AnalysisResult`, which acts as the root aggregate for a single YouTube episode.

| Entity | Description | Key Fields |
| :--- | :--- | :--- |
| **AnalysisResult** | The master record for a show analysis. | `id`, `episodeTitle`, `matchRate`, `avgAge`, `contestants[]`, `couples[]` |
| **Contestant** | Individual participants extracted from the transcript. | `name`, `age`, `role` (Lineup vs Contestant), `outcome` (Matched/Popped) |
| **Couple** | A pair that successfully matched. | `person1` (from Lineup), `person2` (the Contestant) |
| **Metrics** | Global aggregates stored as a singleton. | `episodesAnalyzed`, `overallMatchRate`, `totalParticipants` |
| **Demographics** | Gender distribution across all data. | `male` (%), `female` (%) |

## 2. Database Schema (Firestore)
Data is organized into three main collections:

- **analyses**: Individual episode records. Documents are indexed by a UUID generated at the time of analysis.
- **transcripts**: Secure storage for raw text. Keyed with the same ID as the analysis record for 1:1 mapping. This separation ensures public users can see stats without downloading megabytes of raw text.
- **balloon_data**: Contains singleton documents (`metrics`, `demographics`, `matchData`) used to hydrate the dashboard instantly without scanning the entire analyses collection.

## 3. AI Extraction Logic
The app uses Gemini 2.5 Flash with a strict JSON Response Schema.

- **System Context**: It specifically looks for the "Pop the Balloon" format (Lineup vs Incoming Contestants).
- **Classification**: The AI is instructed to force-classify participants into Lineup (balloon holders) or Contestant (the person walking in).
- **Validation**: Values like `matchRate` are validated to be between 0-100.

## 4. Critical "Need to Know" Details
- **Admin Hardcoding**: The application enforces a strict "Owner-Only" admin policy. The `ADMIN_EMAIL` (default: hejustino@hjdconsulting.ca) is used in `src/App.tsx` and `src/components/modals/SetupGuide.tsx`. Only this email can perform writes/deletes.
- **Security Rules**: The app requires specific Firestore rules (provided in the SetupGuide modal) to allow public reading of stats while restricting `transcripts` and `balloon_data` writes to the verified admin.
- **State Management**: The dashboard calculates "Global Stats" (Metrics/Demographics) incrementally when a new episode is added. However, when an episode is deleted, the App component triggers a full recalculation of stats based on the remaining history to maintain data integrity.
- **Environment Variables**:
    - `import.meta.env.VITE_API_KEY`: Your Gemini API Key.
    - `import.meta.env.VITE_ADMIN_EMAIL`: (Optional) to override the default admin.
    - **Firebase Config**: Configuration is loaded from `.env` and accessed via `import.meta.env.VITE_FIREBASE_*` in `src/services/firebase.ts`.

## 5. Troubleshooting / Insights Generation
If you ask Gemini for insights later, keep in mind:

- **Data Scarcity**: If an analysis was done with an older version of the prompt, `contestants` or `couples` arrays might be missing. The UI handles this gracefully.
- **Transcript Access**: Transcripts are only loaded into the browser when the Admin clicks "View Transcript" in the modal to save bandwidth and improve security.