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
