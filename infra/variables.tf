variable "project_id" {
  description = "The Google Cloud project ID for Balloon"
  type        = string
  default     = "balloon-87473"
}

variable "admin_email" {
  description = "Admin email for security rules and IAM"
  type        = string
  default     = "hejustino@hjdconsulting.ca"
}

variable "region" {
  description = "Default GCP region"
  type        = string
  default     = "us-central1"
}

# Cloud Run stats-api URL (used by Cloud Scheduler ingest job)
variable "stats_api_url" {
  description = "The Cloud Run URL for the stats-api service (e.g. https://stats-api-xxx-uc.a.run.app)"
  type        = string
  default     = "https://stats-api-743597976254.us-central1.run.app"
}

# Domain variables (optional - only needed if using domain module)
variable "domain_name" {
  description = "Custom domain name"
  type        = string
  default     = ""
}

variable "contact_email" {
  description = "Domain contact email"
  type        = string
  default     = ""
}

variable "contact_phone" {
  description = "Domain contact phone"
  type        = string
  default     = ""
}

variable "contact_zip" {
  description = "Domain contact postal code"
  type        = string
  default     = ""
}

variable "contact_country_code" {
  description = "Domain contact country code"
  type        = string
  default     = ""
}
