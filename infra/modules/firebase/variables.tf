variable "project_id" {
  description = "The Google Cloud project ID"
  type        = string
}

variable "admin_email" {
  description = "Admin email for Firestore security rules"
  type        = string
}

variable "bigquery_dataset_id" {
  description = "The ID of the BigQuery dataset to stream data to"
  type        = string
}

variable "location" {
  description = "The location for Firebase resources"
  type        = string
  default     = "us-central1"
}