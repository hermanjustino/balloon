# Terraform block to specify the required provider and its version.
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Configure the Google Cloud provider with the project details.
provider "google" {
  project = var.project_id
}

# Define a variable for the Google Cloud project ID.
# This is extracted from your firebaseConfig in services.ts.
variable "project_id" {
  description = "The Google Cloud project ID for your Firebase project."
  type        = string
  default     = "balloon-87473"
}

# Define a variable for the admin user's email address.
# This is used in the Firestore security rules to grant exclusive write access.
variable "admin_email" {
  description = "The email address of the administrator."
  type        = string
  default     = "hejustino@hjdconsulting.ca"
}

# Enable the necessary Google Cloud APIs for the project to function.
resource "google_project_service" "firebase" {
  project = var.project_id
  service = "firebase.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firestore" {
  project = var.project_id
  service = "firestore.googleapis.com"
  disable_on_destroy = false
  depends_on = [google_project_service.firebase]
}

resource "google_project_service" "identity_toolkit" {
  project = var.project_id
  service = "identitytoolkit.googleapis.com" # Required for Firebase Auth
  disable_on_destroy = false
  depends_on = [google_project_service.firebase]
}

# Define the Firestore security rules in a local variable for clarity.
# The rules allow public reads but restrict all writes to the authenticated admin user.
locals {
  firestore_rules = <<-EOT
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if the user is the designated admin.
    function isAdmin() {
      return request.auth != null && 
             request.auth.token.email_verified == true && 
             request.auth.token.email == '${var.admin_email}';
    }

    // Public read-only access for all data.
    match /{document=**} {
      allow read: if true;
    }

    // Admin-only write access for specific collections and documents.
    match /analyses/{analysisId} {
      allow write: if isAdmin();
    }
    
    match /transcripts/{transcriptId} {
      allow write: if isAdmin();
    }

    match /balloon_data/{docId} {
      allow write: if isAdmin();
    }
  }
}
EOT
}

# Create a Firestore ruleset from the defined rules.
resource "google_firestore_ruleset" "main_rules" {
  project = var.project_id
  source {
    content = local.firestore_rules
  }
  depends_on = [google_project_service.firestore]
}

# Apply (release) the ruleset to the default Firestore database.
resource "google_firestore_rules_release" "main_release" {
  project      = var.project_id
  ruleset_name = google_firestore_ruleset.main_rules.name
  name         = "cloud.firestore" # This should always be 'cloud.firestore' for the main database
  depends_on   = [google_firestore_ruleset.main_rules]
}