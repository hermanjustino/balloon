# Enable BigQuery API
resource "google_project_service" "bigquery" {
  provider = google-beta
  project = var.project_id
  service = "bigquery.googleapis.com"
  disable_on_destroy = false
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

# Note: Firestore to BigQuery streaming is configured via Firebase Extension
# Install via Firebase Console: Extensions → "Stream Collections to BigQuery"
# Configure for collections: contestants, couples, analyses
