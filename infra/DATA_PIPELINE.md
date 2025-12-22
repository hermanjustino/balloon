# Balloon Data Pipeline

## Overview

Automated data pipeline for Firestore → BigQuery analytics. Fully managed via Terraform.

---

## Architecture

```
[Firestore]
    ↓ (Cloud Scheduler: Daily @ 2 AM)
[Export to GCS]
    ↓ (balloon-87473-firestore-exports/)
[BigQuery Load Job]
    ↓
[balloon_dataset]
```

---

## What's Deployed

| Resource | Purpose |
|----------|---------|
| **GCS Bucket** | `balloon-87473-firestore-exports` (auto-deletes after 7 days) |
| **Service Account** | `firestore-exporter@...` with IAM permissions |
| **Cloud Scheduler** | Runs daily at 2 AM (Toronto time) |
| **Collections Exported** | `contestants`, `couples`, `analyses` |

---

## How It Works

### 1. Automatic Export (Daily)
Every day at 2 AM Toronto time, Cloud Scheduler triggers a Firestore export:

```
POST https://firestore.googleapis.com/v1/projects/balloon-87473/databases/(default):exportDocuments
{
  "outputUriPrefix": "gs://balloon-87473-firestore-exports/exports",
  "collectionIds": ["contestants", "couples", "analyses"]
}
```

### 2. Manual Trigger (On-Demand)
To run an export immediately:

```bash
gcloud scheduler jobs run firestore-export-daily \
  --location=us-central1 \
  --project=balloon-87473
```

### 3. Load into BigQuery
Once the export completes, load it into BigQuery:

```bash
# Get the latest export timestamp
EXPORT_PATH=$(gsutil ls gs://balloon-87473-firestore-exports/exports/ | tail -1)

# Load each collection
bq load --source_format=DATASTORE_BACKUP \
  --replace \
  balloon_dataset.contestants \
  ${EXPORT_PATH}all_namespaces/kind_Contestant/all_namespaces_kind_Contestant.export_metadata

bq load --source_format=DATASTORE_BACKUP \
  --replace \
  balloon_dataset.couples \
  ${EXPORT_PATH}all_namespaces/kind_Couple/all_namespaces_kind_Couple.export_metadata
```

---

## SQL Query Examples

### Match Rate by State
```sql
SELECT 
  location.state,
  COUNT(*) as total,
  SUM(CASE WHEN outcome = 'Matched' THEN 1 ELSE 0 END) as matched,
  ROUND(100.0 * SUM(CASE WHEN outcome = 'Matched' THEN 1 ELSE 0 END) / COUNT(*), 2) as match_rate
FROM `balloon-87473.balloon_dataset.contestants`
GROUP BY location.state
ORDER BY match_rate DESC;
```

### Jobs with Highest Match Rates
```sql
SELECT 
  job,
  COUNT(*) as total,
  SUM(CASE WHEN outcome = 'Matched' THEN 1 ELSE 0 END) as matched
FROM `balloon-87473.balloon_dataset.contestants`,
UNNEST(jobs) as job
GROUP BY job
HAVING total >= 5  -- Filter for jobs with at least 5 people
ORDER BY matched DESC;
```

### Kids vs No Kids
```sql
SELECT 
  kids.hasKids,
  COUNT(*) as total,
  ROUND(100.0 * SUM(CASE WHEN outcome = 'Matched' THEN 1 ELSE 0 END) / COUNT(*), 2) as match_rate
FROM `balloon-87473.balloon_dataset.contestants`
WHERE kids IS NOT NULL
GROUP BY kids.hasKids;
```

---

## Cost Estimate

| Component | Monthly Cost |
|-----------|--------------|
| GCS Storage | ~$0.02 (deleted after 7 days) |
| Cloud Scheduler | $0.10 (1 job) |
| Firestore Export | $2.50 (1GB/day estimate) |
| BigQuery Storage | $0.02/GB (~$0.20/month) |
| BigQuery Queries | First 1 TB free |
| **Total** | **~$3/month** |

---

## Next Steps

1. **Populate Data**: Run your migration tool to populate `contestants` and `couples` collections
2. **Manual Test**: Trigger the export manually to verify it works
3. **Load to BigQuery**: Follow the load commands above
4. **Automate Loading** (Optional): Add a Cloud Function to auto-load on export completion

---

## Terraform Management

All infrastructure is in `infra/modules/data-pipeline/`:

```bash
# View current state
terraform show

# Modify schedule (e.g., hourly instead of daily)
# Edit infra/modules/data-pipeline/variables.tf
export_schedule = "0 * * * *"

# Apply changes
terraform apply
```

---

## Troubleshooting

### Check Scheduler Job Status
```bash
gcloud scheduler jobs describe firestore-export-daily \
  --location=us-central1
```

### View Export Logs
```bash
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=firestore-export-daily" \
  --limit=10 \
  --format=json
```

### List Exports in GCS
```bash
gsutil ls -r gs://balloon-87473-firestore-exports/
```
