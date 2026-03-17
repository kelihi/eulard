output "database_name" {
  value = google_sql_database.eulard.name
}

output "database_user" {
  value = google_sql_user.eulard.name
}

output "database_private_ip" {
  value = data.google_sql_database_instance.existing.private_ip_address
}

output "service_account_email" {
  value = google_service_account.eulard.email
}

output "cloud_run_dev_url" {
  value       = google_cloud_run_v2_service.eulard_dev.uri
  description = "Cloud Run dev instance URL"
}
