# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Pop the Balloon" is a data science dashboard for the dating show of the same name. A daily automated pipeline polls the [@PopTheBalloon](https://www.youtube.com/@PopTheBalloon) YouTube channel, fetches captions for new episodes, runs Gemini AI analysis to extract structured episode data (contestants, couples, match rates, demographics), and saves results to Firestore. That data flows to BigQuery via a scheduled export and is aggregated into views served by a Cloud Run backend. The public-facing React dashboard visualizes those stats. An admin panel also exists for manual episode submission.

## Development Commands

### Frontend (root)
```bash
npm run dev       # Vite dev server on port 3000
npm run build     # Production build -> dist/
npm run preview   # Preview production build
```

### With Docker (full stack local dev)
```bash
docker compose up           # Frontend on :3000, backend on :8080
docker compose up frontend  # Frontend only
docker compose up backend   # Backend only
```

The Docker backend mounts `~/.config/gcloud` for ADC credentials to authenticate with BigQuery.

### Backend (backend/)
```bash
npm run dev    # ts-node-dev hot-reload on :8080
npm run build  # tsc compile to dist/
```

### Firebase Functions (functions/)
```bash
npm run build   # tsc compile
npm run serve   # local emulator
npm run deploy  # firebase deploy --only functions
```

### Deployment
```bash
npm run build && firebase deploy --only hosting   # Deploy frontend
firebase deploy --only functions                  # Deploy functions
# Backend deploys to Cloud Run (manual gcloud run deploy)
```

### Infrastructure
```bash
cd infra && terraform plan
cd infra && terraform apply
```

## Environment Variables

Copy `.env` at the root for local dev (no `.env.example` exists — check git history for the shape). Required vars:

| Variable | Used by |
|---|---|
| `VITE_API_KEY` / `GEMINI_API_KEY` | Frontend AI service + backend ingest (Gemini) |
| `VITE_ADMIN_EMAIL` | Frontend auth gate |
| `VITE_FIREBASE_*` | Firebase SDK init |
| `ADMIN_EMAIL` | Backend auth middleware |
| `PROJECT_ID` | Backend BigQuery client |
| `YOUTUBE_API_KEY` | Backend ingest: YouTube Data API v3 channel polling |
| `GEMINI_API_KEY` | Backend ingest: Gemini analysis (server-side) |
| `CHANNEL_HANDLE` | Backend ingest: YouTube channel handle (default: `PopTheBalloon`) |
| `SCHEDULER_SERVICE_ACCOUNT` | Backend ingest: expected OIDC email from Cloud Scheduler |

In dev, `VITE_API_TARGET` overrides the API proxy target (defaults to production Cloud Run URL in `vite.config.ts`).

## Architecture

### Automated ingest pipeline (primary)
```
Cloud Scheduler (daily 09:00 UTC)
  -> POST /ingest/run (Cloud Run stats-api, OIDC auth)
  -> backend/src/ingest.ts
      1. YouTube Data API v3: resolve @PopTheBalloon -> channel ID -> uploads playlist
      2. Filter titles matching "Ep \d+:" pattern
      3. Check Firestore `processed_episodes` — skip already-done video IDs
      4. Fetch captions via YouTube timedtext URL (no auth needed)
      5. Gemini 2.5 Pro: analyzeTranscript -> structured AnalysisResult
      6. Firestore: write analyses + contestants + couples + transcripts
      7. Mark video ID in `processed_episodes` (idempotency)
  -> Firebase BigQuery extension streams Firestore writes to BigQuery
  -> BigQuery aggregated views refresh daily
  -> Cloud Run /api/stats/* serves updated stats to dashboard
```

### Manual admin path (fallback)
```
[AdminPanel] -> [AIService frontend] -> [Firestore] -> [BigQuery] -> [Dashboard]
```

**Auth model:** Single-admin gate — only the email in `VITE_ADMIN_EMAIL` can log in and use admin features. Public users see read-only stats. The ingest endpoint uses Cloud Scheduler OIDC tokens (separate from Firebase Auth).

## Codebase Layout

### Frontend (`src/`)
- **`App.tsx`** — root controller: auth state, page routing (landing / dashboard / search), data fetching, public vs. admin view mode
- **`services/ai.ts`** — Gemini API calls; parses transcripts into `AnalysisResult` (contestants, couples, matchRate, demographics)
- **`services/storage.ts`** — data layer: reads from Cloud Run `/api/stats/*` and Firestore; writes use a **clear-then-upsert** pattern to maintain consistency
- **`services/auth.ts`** — Firebase Auth (Google + email/password)
- **`components/dashboard/`** — `KeyMetrics`, `DemographicsChart`, `AnalysisTable`, `LocationsChart` (all Recharts-based)
- **`components/admin/`** — `AdminPanel` (transcript submission form), `LoginForm`, `MigrationTools`
- **`types/index.ts`** — all shared TypeScript interfaces: `Contestant`, `Couple`, `Demographics`, `Metrics`, `AnalysisResult`, `MatchDataPoint`

### Backend (`backend/src/`)
Express.js on Cloud Run.

- **`index.ts`** — routes + middleware. Endpoints:
  - `GET /api/stats/overview` — aggregated metrics from BigQuery
  - `GET /api/stats/trends` — trend data
  - `GET /api/stats/locations` — location counts
  - `POST /ingest/run` — triggers the ingest pipeline (Cloud Scheduler OIDC auth)
  - `GET /health` — public health check
- **`ingest.ts`** — the full automated pipeline: YouTube channel polling → caption fetch → Gemini analysis → Firestore save. Key functions: `resolveChannelId`, `listRecentEpisodes`, `fetchCaptions`, `analyzeTranscript`, `saveToFirestore`, `runIngest`.

Firebase ID token validation middleware guards `/api/stats/*`. The `/ingest/run` route uses a separate OIDC token check against `SCHEDULER_SERVICE_ACCOUNT`.

### Firebase Functions (`functions/src/index.ts`)
The `getStats` callable function is **superseded** by the Cloud Run backend — BigQuery code is commented out. Functions are largely vestigial.

### Infrastructure (`infra/`)
Terraform manages Firebase (Firestore, Auth, Hosting) and BigQuery. Three SQL aggregation views in `infra/modules/bigquery/queries/` drive the Cloud Run API responses.

### Data Scripts (`backend/src/scripts/`)
One-off ts-node scripts for data maintenance (deduplication, backfill, integrity checks). Run via `npx ts-node src/scripts/<script>.ts` from `backend/`.

## Key Patterns

- **Episode IDs are deterministic** — format `ep_<number>` (e.g. `ep_92`), derived from the episode number in the video title. Safe to re-run without creating duplicates.
- **Idempotency via `processed_episodes`** — the ingest pipeline writes a document to this Firestore collection keyed by YouTube video ID after successful processing. On the next run it skips any video ID already present.
- **Caption fetch strategy** — `ingest.ts:fetchCaptions` scrapes the `captionTracks` JSON from the YouTube video HTML page, then hits the `baseUrl` of the English ASR track directly. No API key or auth required.
- **Firestore is the source of truth** for raw data; BigQuery is derived via scheduled Firebase extension export and used only for aggregated read queries.
- **No test suite** — there are no test scripts configured anywhere in this repo.
- **No linter configured** — TypeScript compiler (`tsc`) is the only static analysis in use.
