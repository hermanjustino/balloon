# Enable required APIs
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

# Configure Cloud DNS
resource "google_dns_managed_zone" "main" {
  provider = google-beta
  project     = var.project_id
  name        = replace(var.domain_name, ".", "-")
  dns_name    = "${var.domain_name}."
  description = "DNS zone for ${var.domain_name}"
  
  depends_on = [google_project_service.dns]
}

# Register the Domain
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
    privacy = "REDACTED_CONTACT_DATA"
    
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

# Map Custom Domain to Firebase Hosting
resource "google_firebase_hosting_custom_domain" "main" {
  provider = google-beta
  project = var.project_id
  site_id = var.firebase_hosting_site_id
  custom_domain = var.domain_name
}
