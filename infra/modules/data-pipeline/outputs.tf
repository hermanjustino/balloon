output "export_bucket_name" {
  description = "GCS bucket for Firestore exports"
  value       = google_storage_bucket.firestore_exports.name
}

output "export_schedule" {
  description = "Cron schedule for exports"
  value       = google_cloud_scheduler_job.firestore_export.schedule
}

output "service_account_email" {
  description = "Service account email for the export pipeline"
  value       = google_service_account.firestore_exporter.email
}
