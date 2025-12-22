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
