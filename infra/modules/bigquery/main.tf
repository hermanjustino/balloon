resource "google_project_service" "bigquery" {
  provider = google-beta
  project = var.project_id
  service = "bigquery.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "bigquery_data_transfer" {
  provider = google-beta
  project = var.project_id
  service = "bigquerydatatransfer.googleapis.com"
  disable_on_destroy = false
}

# Service Account for the Stats API (Cloud Functions)
resource "google_service_account" "stats_api" {
  provider     = google-beta
  project      = var.project_id
  account_id   = "stats-api-sa"
  display_name = "Stats API Service Account"
}

# Grant BigQuery Viewer role to the Stats API service account
resource "google_project_iam_member" "stats_api_bq_viewer" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/bigquery.dataViewer"
  member   = "serviceAccount:${google_service_account.stats_api.email}"
}

resource "google_project_iam_member" "stats_api_bq_job_user" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/bigquery.jobUser"
  member   = "serviceAccount:${google_service_account.stats_api.email}"
}

# Service Account for BigQuery Data Transfer (Scheduled Queries)
resource "google_service_account" "bq_transfer" {
  provider     = google-beta
  project      = var.project_id
  account_id   = "bq-transfer-sa"
  display_name = "BigQuery Data Transfer Service Account"
}

resource "google_project_iam_member" "bq_transfer_editor" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/bigquery.dataEditor"
  member   = "serviceAccount:${google_service_account.bq_transfer.email}"
}

resource "google_project_iam_member" "bq_transfer_job_user" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/bigquery.jobUser"
  member   = "serviceAccount:${google_service_account.bq_transfer.email}"
}

# Create BigQuery Dataset
resource "google_bigquery_dataset" "balloon" {
  provider   = google-beta
  project    = var.project_id
  dataset_id = "balloon_dataset"
  location   = var.dataset_location
  
  description = "Balloon analytics data exported from Firestore"
  
  access {
    role          = "OWNER"
    user_by_email = var.admin_email
  }
  
  # Allow public read access for analysis
  access {
    role          = "READER"
    special_group = "projectReaders"
  }
  
  depends_on = [google_project_service.bigquery]
}

# Scheduled Query to Pre-compute Metrics (Pure OLAP)
resource "google_bigquery_data_transfer_config" "metrics_aggregator" {
  provider               = google-beta
  project                = var.project_id
  display_name           = "Daily Metrics Aggregator"
  location               = var.dataset_location
  data_source_id         = "scheduled_query"
  schedule               = "every 24 hours"
  destination_dataset_id = google_bigquery_dataset.balloon.dataset_id
  service_account_name   = google_service_account.bq_transfer.email
  
  params = {
    destination_table_name_template = "aggregated_metrics"
    write_disposition              = "WRITE_TRUNCATE"
    query                          = templatefile("${path.module}/queries/metrics_aggregator.sql", {
      project_id = var.project_id
    })
  }

  depends_on = [
    google_project_service.bigquery_data_transfer,
    google_bigquery_dataset.balloon
  ]
}
