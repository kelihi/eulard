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
