output "dataset_id" {
  description = "BigQuery dataset ID"
  value       = google_bigquery_dataset.balloon.dataset_id
}

output "dataset_location" {
  description = "BigQuery dataset location"
  value       = google_bigquery_dataset.balloon.location
}

output "stats_api_sa_email" {
  description = "Service account email for Stats API"
  value       = google_service_account.stats_api.email
}
