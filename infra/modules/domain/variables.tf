variable "project_id" {
  description = "The Google Cloud project ID"
  type        = string
}

variable "domain_name" {
  description = "The domain name to register"
  type        = string
}

variable "contact_email" {
  description = "Contact email for domain registration"
  type        = string
}

variable "contact_phone" {
  description = "Contact phone for domain registration"
  type        = string
}

variable "contact_zip" {
  description = "Contact postal code"
  type        = string
}

variable "contact_country_code" {
  description = "Contact country code"
  type        = string
  default     = "CA"
}

variable "firebase_hosting_site_id" {
  description = "Firebase Hosting site ID to map domain to"
  type        = string
}
