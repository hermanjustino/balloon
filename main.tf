terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
}

provider "google-beta" {
  project = var.project_id
}

variable "project_id" {
  description = "The Google Cloud project ID for your Firebase project."
  type        = string
  default     = "balloon-87473"
}

variable "admin_email" {
  description = "The email address of the administrator."
  type        = string
  default     = "hejustino@hjdconsulting.ca"
}

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

locals {
  firestore_rules = <<-EOT
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAdmin() {
      return request.auth != null && 
             request.auth.token.email_verified == true && 
             request.auth.token.email == '${var.admin_email}';
    }

    match /{document=**} {
      allow read: if true;
    }

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

resource "google_firebaserules_ruleset" "main_rules" {
  provider = google-beta
  project = var.project_id
  source {
    files {
      name    = "firestore.rules"
      content = local.firestore_rules
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

# ========================================================================================
# DOMAIN & DNS CONFIGURATION
# ========================================================================================

resource "google_project_service" "domains" {
  provider = google-beta
  project = var.project_id
  service = "domains.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "dns" {
  provider = google-beta
  project = var.project_id
  service = "dns.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firebase_hosting" {
  provider = google-beta
  project = var.project_id
  service = "firebasehosting.googleapis.com"
  disable_on_destroy = false
}

variable "domain_name" {
  description = "The domain name to register"
  type        = string
}

variable "contact_email" { type = string }
variable "contact_phone" { type = string }
variable "contact_country_code" { 
  type    = string 
  default = "CA" 
}
variable "contact_zip" { type = string }

# 1. Register the Domain
resource "google_clouddomains_registration" "main" {
  provider = google-beta
  project  = var.project_id
  location = "global"
  domain_name = var.domain_name

  yearly_price {
    currency_code = "USD"
    units         = 12
  }

  dns_settings {
    custom_dns {
        name_servers = google_dns_managed_zone.main.name_servers
    }
  }

  contact_settings {
    privacy = "REDACTED_CONTACT_DATA" # Fallback for .xyz
    
    registrant_contact {
      email        = var.contact_email
      phone_number = var.contact_phone
      postal_address {
        region_code   = var.contact_country_code
        postal_code   = var.contact_zip
        locality      = "Toronto"
        administrative_area = "ON"
        address_lines = ["25 Warrender Avenue"]
        recipients    = ["Herman Justino"]
      }
    }
    
    admin_contact {
      email        = var.contact_email
      phone_number = var.contact_phone
      postal_address {
        region_code   = var.contact_country_code
        postal_code   = var.contact_zip
        locality      = "Toronto"
        administrative_area = "ON"
        address_lines = ["25 Warrender Avenue"]
        recipients    = ["Herman Justino"]
      }
    }
    
    technical_contact {
      email        = var.contact_email
      phone_number = var.contact_phone
      postal_address {
        region_code   = var.contact_country_code
        postal_code   = var.contact_zip
        locality      = "Toronto"
        administrative_area = "ON"
        address_lines = ["25 Warrender Avenue"]
        recipients    = ["Herman Justino"]
      }
    }
  }

  depends_on = [google_project_service.domains]
}

# 2. Configure Cloud DNS
resource "google_dns_managed_zone" "main" {
  provider = google-beta
  project     = var.project_id
  name        = replace(var.domain_name, ".", "-")
  dns_name    = "${var.domain_name}."
  description = "DNS zone for ${var.domain_name}"
  
  depends_on = [google_project_service.dns]
}

# 3. Configure Firebase Hosting Site
resource "google_firebase_hosting_site" "main" {
  provider = google-beta
  project = var.project_id
  site_id = var.project_id
  depends_on = [google_project_service.firebase_hosting]
}

# 4. Map Custom Domain to Firebase Hosting
resource "google_firebase_hosting_custom_domain" "main" {
  provider = google-beta
  project = var.project_id
  site_id = google_firebase_hosting_site.main.site_id
  custom_domain = var.domain_name
}

# Note: DNS records for Firebase Hosting will be created manually or via Firebase CLI
# after checking the required_dns_updates output from the custom_domain resource.