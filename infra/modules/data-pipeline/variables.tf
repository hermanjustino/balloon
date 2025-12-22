variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "export_schedule" {
  description = "Cron schedule for Firestore exports (default: daily at 2 AM)"
  type        = string
  default     = "0 2 * * *"
}

variable "collections_to_export" {
  description = "Firestore collections to export"
  type        = list(string)
  default     = ["contestants", "couples", "analyses"]
}

variable "bigquery_dataset_id" {
  description = "BigQuery dataset ID for loading data"
  type        = string
}
