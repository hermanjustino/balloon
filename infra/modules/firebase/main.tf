# Enable Firebase APIs
resource "google_project_service" "firebase" {
  provider = google-beta
  project = var.project_id
  service = "firebase.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firestore" {
  provider = google-beta
  project = var.project_id
  service = "firestore.googleapis.com"
  disable_on_destroy = false
  depends_on = [google_project_service.firebase]
}

resource "google_project_service" "identity_toolkit" {
  provider = google-beta
  project = var.project_id
  service = "identitytoolkit.googleapis.com"
  disable_on_destroy = false
  depends_on = [google_project_service.firebase]
}

resource "google_project_service" "firebase_hosting" {
  provider = google-beta
  project = var.project_id
  service = "firebasehosting.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firebase_extensions" {
  provider = google-beta
  project = var.project_id
  service = "firebaseextensions.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifact_registry" {
  provider = google-beta
  project = var.project_id
  service = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloud_build" {
  provider = google-beta
  project = var.project_id
  service = "cloudbuild.googleapis.com"
  disable_on_destroy = false
}

# Get project number for service account construction
data "google_project" "project" {
  provider = google-beta
  project_id = var.project_id
}

# Grant Artifact Registry Writer to the Cloud Build Service Account
resource "google_project_iam_member" "cloud_build_artifact_writer" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/artifactregistry.repoAdmin" # Admin allows creating the gcf-artifacts repo if it doesn't exist
  member   = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
  depends_on = [google_project_service.cloud_build]
}

# Grant Artifact Registry Writer to the Default Compute Service Account (often used by Cloud Build)
resource "google_project_iam_member" "compute_artifact_writer" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/artifactregistry.repoAdmin"
  member   = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  depends_on = [google_project_service.firestore]
}

# Firestore Security Rules
resource "google_firebaserules_ruleset" "main_rules" {
  provider = google-beta
  project = var.project_id
  source {
    files {
      name    = "firestore.rules"
      content = templatefile("${path.root}/firestore.rules", {
        admin_email = var.admin_email
      })
    }
  }
  depends_on = [google_project_service.firestore]
}

resource "google_firebaserules_release" "main_release" {
  provider = google-beta
  project      = var.project_id
  ruleset_name = google_firebaserules_ruleset.main_rules.name
  name         = "cloud.firestore"
  depends_on   = [google_firebaserules_ruleset.main_rules]
}

# Firebase Hosting Site
resource "google_firebase_hosting_site" "main" {
  provider = google-beta
  project = var.project_id
  site_id = var.project_id
  depends_on = [google_project_service.firebase_hosting]
}

# ============================================================================
# FIREBASE EXTENSIONS: Stream Collections to BigQuery
# ============================================================================

resource "google_firebase_extensions_instance" "contestants_export" {
  provider = google-beta
  project  = var.project_id
  instance_id = "firestore-bigquery-contestants"
  config {
    extension_ref = "firebase/firestore-bigquery-export"
    params = {
      COLLECTION_PATH               = "contestants"
      DATASET_ID                    = var.bigquery_dataset_id
      TABLE_ID                      = "contestants"
      LOCATION                      = var.location
      BIGQUERY_PROJECT_ID           = var.project_id
      DATABASE_ID                   = "(default)"
      DATABASE_REGION               = var.location
      DATASET_LOCATION              = "us"
      VIEW_TYPE                     = "view"
      LOG_LEVEL                     = "info"
      EXCLUDE_OLD_DATA              = "no"
      WILDCARD_IDS                  = "false"
      MAX_DISPATCHES_PER_SECOND     = "100"
      MAX_ENQUEUE_ATTEMPTS          = "3"
      TABLE_PARTITIONING            = "NONE"
      USE_NEW_SNAPSHOT_QUERY_SYNTAX = "no"
    }
  }
  depends_on = [google_project_service.firebase_extensions]
}

resource "google_firebase_extensions_instance" "couples_export" {
  provider = google-beta
  project  = var.project_id
  instance_id = "firestore-bigquery-couples"
  config {
    extension_ref = "firebase/firestore-bigquery-export"
    params = {
      COLLECTION_PATH               = "couples"
      DATASET_ID                    = var.bigquery_dataset_id
      TABLE_ID                      = "couples"
      LOCATION                      = var.location
      BIGQUERY_PROJECT_ID           = var.project_id
      DATABASE_ID                   = "(default)"
      DATABASE_REGION               = var.location
      DATASET_LOCATION              = "us"
      VIEW_TYPE                     = "view"
      LOG_LEVEL                     = "info"
      EXCLUDE_OLD_DATA              = "no"
      WILDCARD_IDS                  = "false"
      MAX_DISPATCHES_PER_SECOND     = "100"
      MAX_ENQUEUE_ATTEMPTS          = "3"
      TABLE_PARTITIONING            = "NONE"
      USE_NEW_SNAPSHOT_QUERY_SYNTAX = "no"
    }
  }
  depends_on = [google_project_service.firebase_extensions]
}

resource "google_firebase_extensions_instance" "analyses_export" {
  provider = google-beta
  project  = var.project_id
  instance_id = "firestore-bigquery-analyses"
  config {
    extension_ref = "firebase/firestore-bigquery-export"
    params = {
      COLLECTION_PATH               = "analyses"
      DATASET_ID                    = var.bigquery_dataset_id
      TABLE_ID                      = "analyses"
      LOCATION                      = var.location
      BIGQUERY_PROJECT_ID           = var.project_id
      DATABASE_ID                   = "(default)"
      DATABASE_REGION               = var.location
      DATASET_LOCATION              = "us"
      VIEW_TYPE                     = "view"
      LOG_LEVEL                     = "info"
      EXCLUDE_OLD_DATA              = "no"
      WILDCARD_IDS                  = "false"
      MAX_DISPATCHES_PER_SECOND     = "100"
      MAX_ENQUEUE_ATTEMPTS          = "3"
      TABLE_PARTITIONING            = "NONE"
      USE_NEW_SNAPSHOT_QUERY_SYNTAX = "no"
    }
  }
  depends_on = [google_project_service.firebase_extensions]
}