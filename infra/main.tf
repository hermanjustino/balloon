provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ============================================================================
# INGEST PIPELINE
# Cloud Scheduler → stats-api Cloud Run /ingest/run (daily)
# ============================================================================

# Enable required APIs
resource "google_project_service" "youtube" {
  project            = var.project_id
  service            = "youtube.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudscheduler" {
  project            = var.project_id
  service            = "cloudscheduler.googleapis.com"
  disable_on_destroy = false
}

# Dedicated service account for Cloud Scheduler to invoke the ingest endpoint
resource "google_service_account" "ingest_scheduler" {
  project      = var.project_id
  account_id   = "ingest-scheduler-sa"
  display_name = "Ingest Scheduler Service Account"
}

# Allow the scheduler SA to invoke Cloud Run services
resource "google_project_iam_member" "ingest_scheduler_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.ingest_scheduler.email}"
}

# Cloud Scheduler job — runs daily at 9 AM UTC
# Adjust the schedule to match the channel's typical upload cadence
resource "google_cloud_scheduler_job" "ingest_daily" {
  project     = var.project_id
  region      = var.region
  name        = "balloon-ingest-daily"
  description = "Triggers the Pop the Balloon episode ingest pipeline daily"
  schedule    = "0 9 * * *"
  time_zone   = "UTC"

  http_target {
    uri         = "${var.stats_api_url}/ingest/run"
    http_method = "POST"
    body        = base64encode("{}")
    headers = {
      "Content-Type" = "application/json"
    }

    oidc_token {
      service_account_email = google_service_account.ingest_scheduler.email
      audience              = var.stats_api_url
    }
  }

  depends_on = [google_project_service.cloudscheduler]
}

# ============================================================================
# FIREBASE MODULE
# Handles: Firebase APIs, Firestore, Auth, Hosting
# ============================================================================
module "firebase" {
  source = "./modules/firebase"
  
  project_id          = var.project_id
  admin_email         = var.admin_email
  bigquery_dataset_id = module.bigquery.dataset_id
  
  depends_on = [module.bigquery]
}

# ============================================================================
# BIGQUERY MODULE
# Handles: BigQuery dataset for SQL analytics
# ============================================================================
module "bigquery" {
  source = "./modules/bigquery"
  
  project_id  = var.project_id
  admin_email = var.admin_email
}



# ============================================================================
# DOMAIN MODULE (OPTIONAL)
# Handles: Domain registration, DNS, Firebase Hosting custom domain
# Uncomment and configure variables to enable
# ============================================================================
# module "domain" {
#   source = "./modules/domain"
#   
#   project_id               = var.project_id
#   domain_name              = var.domain_name
#   contact_email            = var.contact_email
#   contact_phone            = var.contact_phone
#   contact_zip              = var.contact_zip
#   firebase_hosting_site_id = module.firebase.hosting_site_id
# }