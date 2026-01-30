# Context Export: Balloon Technical Handover

This document centralizes the technical context, changes, and current state of the Balloon project as of January 30, 2026.

## 🏁 Summary of Work Accomplished
We have implemented a robust "Clear-then-Upsert" architecture with deterministic episode IDs to ensure data integrity across Firestore and BigQuery, resolving "ghost" record issues and duplicate counts.

## 🛠️ Technical Changes

### 1. Deterministic Data Identity
- **File**: `src/services/ai.ts`
- **Change**: Updated `analyzeTranscript` to use stable IDs based on `episodeNumber` (e.g., `ep_89`).
- **Benefit**: Re-analyzing an episode now overwrites the same document instead of creating duplicates.

### 2. "Clear-then-Upsert" Pattern
- **File**: `src/services/storage.ts`
- **Methods**: `saveContestants`, `saveCouples`
- **Change**: Added a "pre-save" query that deletes all existing records for a given `episodeId` before writing new ones.
- **Benefit**: Prevents accumulation of orphaned or duplicate contestant/couple records.

### 3. Cascade Deletion
- **File**: `src/services/storage.ts`
- **Method**: `deleteAnalysis`
- **Change**: Added logic to automatically delete all associated `contestants` and `couples` when an analysis is removed.

### 4. Docker & Development Environment
- **File**: `docker-compose.yml`
- **Changes**:
    - Mapped frontend to port **3000**.
    - Mounted `.env` file to the frontend container to expose `VITE_API_KEY`.
    - Integrated with local `gcloud` credentials for BigQuery access.

## 🧹 Cleanup Operations Performed
- Removed **171 duplicate analyses** from Firestore.
- Removed **74 orphaned contestants** and **2 orphaned couples**.
- Reset the total episode count to the correct number (**89**).
- **Contestant Count Sync**: Resolved a discrepancy where the front page showed 1330 instead of 1262. Manually triggered BigQuery aggregation to sync stale metrics with clean Firestore data.
- **Burton Case Study**: Investigated a reported duplicate of "Burton". Confirmed he is a **returning contestant** appearing in Ep 75 (Eliminated) and Ep 89 (Matched). The system correctly tracks these as separate appearances.

## 📊 Current System State
- **Frontend**: Accessible at `http://localhost:3000` (Local) and `luvlytics.xyz` (Production).
- **Backend API**: Cloud Run service `stats-api`.
- **Database**: 
    - **Firestore**: Clean state with 89 episodes and correctly linked contestants.
    - **BigQuery**: Scheduled transfer `Daily Metrics Aggregator` runs every 24h.

## 🚀 Next Steps
- [ ] Push local changes (`ai.ts`, `storage.ts`, `docker-compose.yml`) to GitHub.
- [ ] Deploy to production via Firebase Hosting and Cloud Run.
- [ ] Run "Re-Analyze All" on production to apply the clean state to the live dashboard.

---
**Export Date**: 2026-01-30 01:10 UTC
**Project ID**: balloon-87473
