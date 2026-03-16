# =============================================================================
# Eulard Infrastructure — GCP Resources
# =============================================================================
# Creates: database, service account, secrets, Workload Identity binding
# Requires: existing Cloud SQL instance and GKE cluster from chassis-infra
# =============================================================================

# -----------------------------------------------------------------------------
# Cloud SQL — Database and User (on shared instance)
# -----------------------------------------------------------------------------

resource "random_password" "db_password" {
  length  = 32
  special = false

  lifecycle {
    ignore_changes = [length, special]
  }
}

resource "google_sql_database" "eulard" {
  name     = "eulard"
  instance = var.cloudsql_instance_name
  project  = var.project_id
}

resource "google_sql_user" "eulard" {
  name     = "eulard-app"
  instance = var.cloudsql_instance_name
  password = random_password.db_password.result
  project  = var.project_id
}

# -----------------------------------------------------------------------------
# IAM — Service Account with Workload Identity
# -----------------------------------------------------------------------------

resource "google_service_account" "eulard" {
  account_id   = "eulard-sa"
  display_name = "Eulard Service Account"
  project      = var.project_id
}

# Cloud SQL client access
resource "google_project_iam_member" "eulard_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.eulard.email}"
}

# Cloud Logging
resource "google_project_iam_member" "eulard_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.eulard.email}"
}

# Workload Identity binding: K8s SA → GCP SA
resource "google_service_account_iam_member" "eulard_workload_identity" {
  service_account_id = google_service_account.eulard.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[eulard/eulard-sa]"
}

# -----------------------------------------------------------------------------
# Secret Manager — Application Secrets
# -----------------------------------------------------------------------------

locals {
  secrets = [
    "eulard-nextauth-secret",
    "eulard-db-password",
    "eulard-google-oauth-client-id",
    "eulard-google-oauth-client-secret",
    "eulard-anthropic-api-key",
  ]
}

resource "google_secret_manager_secret" "eulard" {
  for_each  = toset(local.secrets)
  secret_id = "${each.value}-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

# Store the auto-generated DB password
resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.eulard["eulard-db-password"].id
  secret_data = random_password.db_password.result
}

# Grant the eulard SA access to all eulard secrets
resource "google_secret_manager_secret_iam_member" "eulard_access" {
  for_each  = toset(local.secrets)
  secret_id = google_secret_manager_secret.eulard[each.value].secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.eulard.email}"
}

# -----------------------------------------------------------------------------
# Data Sources — Existing Infrastructure
# -----------------------------------------------------------------------------

data "google_sql_database_instance" "existing" {
  name    = var.cloudsql_instance_name
  project = var.project_id
}
