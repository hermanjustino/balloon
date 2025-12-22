variable "project_id" {
  description = "The Google Cloud project ID"
  type        = string
}

variable "admin_email" {
  description = "Admin email for BigQuery dataset access"
  type        = string
}

variable "dataset_location" {
  description = "BigQuery dataset location"
  type        = string
  default     = "US"
}
