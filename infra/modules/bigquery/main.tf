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

# Get project number for the BigQuery Data Transfer Service Agent
data "google_project" "project" {
  provider = google-beta
  project_id = var.project_id
}

# Allow BigQuery Data Transfer Service to act as the Service Account
resource "google_service_account_iam_member" "bq_transfer_impersonation" {
  provider           = google-beta
  service_account_id = google_service_account.bq_transfer.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-bigquerydatatransfer.iam.gserviceaccount.com"
}

# 1. Grant the Compute Service Account permission to receive Eventarc events
resource "google_project_iam_member" "compute_event_receiver" {
  project = "balloon-87473"
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:743597976254-compute@developer.gserviceaccount.com"
}

# 2. Ensure the Eventarc Service Agent has its required role
resource "google_project_iam_member" "eventarc_service_agent" {
  project = "balloon-87473"
  role    = "roles/eventarc.serviceAgent"
  member  = "serviceAccount:service-743597976254@gcp-sa-eventarc.iam.gserviceaccount.com"
}

# 3. Artifact Registry Reader (Cloud Functions Gen2 needs this to build)
resource "google_project_iam_member" "functions_resolver" {
  project = "balloon-87473"
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:743597976254-compute@developer.gserviceaccount.com"
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

  access {
    role          = "OWNER"
    user_by_email = google_service_account.bq_transfer.email
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

resource "google_bigquery_data_transfer_config" "trends_aggregator" {
  provider               = google-beta
  project                = var.project_id
  display_name           = "Daily Trends Aggregator"
  location               = var.dataset_location
  data_source_id         = "scheduled_query"
  schedule               = "every 24 hours"
  destination_dataset_id = google_bigquery_dataset.balloon.dataset_id
  service_account_name   = google_service_account.bq_transfer.email
  
  params = {
    destination_table_name_template = "aggregated_trends"
    write_disposition              = "WRITE_TRUNCATE"
    query                          = templatefile("${path.module}/queries/trends_aggregator.sql", {
      project_id = var.project_id
    })
  }

  depends_on = [
    google_project_service.bigquery_data_transfer,
    google_bigquery_dataset.balloon
  ]
}

resource "google_bigquery_data_transfer_config" "locations_aggregator" {
  provider               = google-beta
  project                = var.project_id
  display_name           = "Daily Locations Aggregator"
  location               = var.dataset_location
  data_source_id         = "scheduled_query"
  schedule               = "every 24 hours"
  destination_dataset_id = google_bigquery_dataset.balloon.dataset_id
  service_account_name   = google_service_account.bq_transfer.email
  
  params = {
    destination_table_name_template = "aggregated_locations"
    write_disposition              = "WRITE_TRUNCATE"
    query                          = templatefile("${path.module}/queries/locations_aggregator.sql", {
      project_id = var.project_id
    })
  }

  depends_on = [
    google_project_service.bigquery_data_transfer,
    google_bigquery_dataset.balloon
  ]
}