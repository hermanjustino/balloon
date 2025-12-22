# Lesson 02: OLTP vs OLAP - The "Pure OLAP" Pattern

## Context
The Balloon app was initially built using a "React-as-Database" and "React-as-Analytics-Engine" pattern.
- **Problem**: Every time an episode was analyzed, the frontend had to fetch *all* previous history, perform complex math (averages, demographic distribution, matching trends), and then save those results back to Firestore as "Metrics" singletons.
- **Risks**: Race conditions (two admins analyzing at once would overwrite each other), performance degradation as data grows, and "Dirty OLTP" (storing analytical results alongside transactional data).

## Decision
We implemented a strict separation of concerns following the **Signal Architecture**:
1.  **Firestore is OLTP** (Online Transactional Processing): It only stores raw, normalized results (contestants, couples, analyses).
2.  **BigQuery is OLAP** (Online Analytical Processing): A daily pipeline exports Firestore to BigQuery.
3.  **Pure OLAP SQL**: We calculate truth from the lowest-level data points (raw rows) using a BigQuery Scheduled Query, rather than trusting pre-calculated fields.
4.  **Stats API**: A secure Google Cloud Function queries the BigQuery aggregation table and serves it to the frontend.

## Tradeoff
- **Freshness vs. Accuracy**: The dashboard is no longer "real-time." It updates daily after the BigQuery sync.
- **Complexity**: We added a Cloud Function, a BigQuery dataset, and a scheduled query.
- **Benefit**: The app is now infinitely scalable. The frontend remains thin and fast, and the "Source of Truth" is verifiable SQL rather than black-box client-side JavaScript.

## Lesson
**"Don't do math in the frontend that you can't verify in the database."**

Transactional databases (Firestore) are bad at aggregation. Analytical databases (BigQuery) are bad at transactions. By decoupling them with a proper OLAP pattern, we move from a "prototype" to a "data platform."

### Implementation Details
- **SQL**: Stored in `infra/modules/bigquery/queries/metrics_aggregator.sql`.
- **API**: Firebase Function `getStats`.
- **Cleanup**: Deleted `src/utils/stats.ts` and 100+ lines of state management in `App.tsx`.