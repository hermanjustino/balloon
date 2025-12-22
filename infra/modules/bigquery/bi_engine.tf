# Enable BI Engine Reservation
resource "google_bigquery_bi_reservation" "reservation" {
  provider = google-beta
  project  = var.project_id
  location = var.dataset_location
  size     = 1073741824 # 1 GB
}
