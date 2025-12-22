output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "bigquery_dataset" {
  description = "BigQuery dataset ID for analytics"
  value       = module.bigquery.dataset_id
}

output "firebase_hosting_site" {
  description = "Firebase Hosting site ID"
  value       = module.firebase.hosting_site_id
}

output "stats_api_sa_email" {
  description = "Service account email for Stats API"
  value       = module.bigquery.stats_api_sa_email
}

output "export_bucket" {
  description = "GCS bucket for Firestore exports"
  value       = module.data_pipeline.export_bucket_name
}

output "export_schedule" {
  description = "Schedule for daily Firestore exports"
  value       = module.data_pipeline.export_schedule
}
