# Enable required APIs
resource "google_project_service" "cloud_scheduler" {
  provider = google-beta
  project = var.project_id
  service = "cloudscheduler.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloud_functions" {
  provider = google-beta
  project = var.project_id
  service = "cloudfunctions.googleapis.com"
  disable_on_destroy = false
}

# GCS Bucket for Firestore Exports
resource "google_storage_bucket" "firestore_exports" {
  provider = google-beta
  project  = var.project_id
  name     = "${var.project_id}-firestore-exports"
  location = var.region
  
  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = 7  # Delete exports older than 7 days
    }
    action {
      type = "Delete"
    }
  }
}

# Service Account for Firestore Export
resource "google_service_account" "firestore_exporter" {
  provider     = google-beta
  project      = var.project_id
  account_id   = "firestore-exporter"
  display_name = "Firestore Export Service Account"
}

# Grant permissions to export Firestore
resource "google_project_iam_member" "firestore_export_admin" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/datastore.importExportAdmin"
  member   = "serviceAccount:${google_service_account.firestore_exporter.email}"
}

# Grant permissions to write to GCS
resource "google_storage_bucket_iam_member" "exporter_storage_admin" {
  provider = google-beta
  bucket   = google_storage_bucket.firestore_exports.name
  role     = "roles/storage.admin"
  member   = "serviceAccount:${google_service_account.firestore_exporter.email}"
}

# Grant permissions to load into BigQuery
resource "google_project_iam_member" "bigquery_data_editor" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/bigquery.dataEditor"
  member   = "serviceAccount:${google_service_account.firestore_exporter.email}"
}

resource "google_project_iam_member" "bigquery_job_user" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/bigquery.jobUser"
  member   = "serviceAccount:${google_service_account.firestore_exporter.email}"
}

# Cloud Scheduler Job to trigger export
resource "google_cloud_scheduler_job" "firestore_export" {
  provider = google-beta
  project  = var.project_id
  name     = "firestore-export-daily"
  region   = var.region
  schedule = var.export_schedule
  time_zone = "America/Toronto"
  
  http_target {
    uri         = "https://firestore.googleapis.com/v1/projects/${var.project_id}/databases/(default):exportDocuments"
    http_method = "POST"
    
    headers = {
      "Content-Type" = "application/json"
    }
    
    body = base64encode(jsonencode({
      outputUriPrefix = "gs://${google_storage_bucket.firestore_exports.name}/exports"
      collectionIds   = var.collections_to_export
    }))
    
    oauth_token {
      service_account_email = google_service_account.firestore_exporter.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
  
  depends_on = [
    google_project_service.cloud_scheduler,
    google_storage_bucket.firestore_exports,
    google_project_iam_member.firestore_export_admin
  ]
}

# Note: BigQuery load jobs are triggered manually or via a Cloud Function
# For a fully automated pipeline, add a Cloud Function that:
# 1. Triggers on GCS object.finalize event (when export completes)
# 2. Loads the exported data into BigQuery tables
