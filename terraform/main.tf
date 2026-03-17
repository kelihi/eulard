# =============================================================================
# Eulard Infrastructure — GCP Resources
# =============================================================================
# Creates: database, service account, secrets, Workload Identity binding,
#          Cloud Run dev instance
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
# Cloud Run — Dev Instance
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "eulard_dev" {
  name     = "eulard-dev"
  location = var.region
  project  = var.project_id

  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.eulard.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [data.google_sql_database_instance.existing.connection_name]
      }
    }

    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/eulard/eulard:latest"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      # Plain environment variables
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "NEXT_TELEMETRY_DISABLED"
        value = "1"
      }
      env {
        name  = "HOSTNAME"
        value = "0.0.0.0"
      }
      env {
        name  = "PORT"
        value = "3000"
      }
      env {
        name  = "DB_HOST"
        value = "127.0.0.1"
      }
      env {
        name  = "DB_PORT"
        value = "5432"
      }
      env {
        name  = "DB_NAME"
        value = google_sql_database.eulard.name
      }
      env {
        name  = "DB_USER"
        value = google_sql_user.eulard.name
      }
      env {
        name  = "DB_SSL"
        value = "false"
      }
      env {
        name  = "AUTH_GOOGLE_ALLOWED_DOMAINS"
        value = "kelihi.com"
      }
      env {
        name  = "AUTH_TRUST_HOST"
        value = "true"
      }

      # Secrets from Secret Manager
      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.eulard["eulard-db-password"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "NEXTAUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.eulard["eulard-nextauth-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "AUTH_GOOGLE_CLIENT_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.eulard["eulard-google-oauth-client-id"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "AUTH_GOOGLE_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.eulard["eulard-google-oauth-client-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.eulard["eulard-anthropic-api-key"].secret_id
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      startup_probe {
        http_get {
          path = "/api/healthz"
          port = 3000
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
        timeout_seconds       = 3
      }

      liveness_probe {
        http_get {
          path = "/api/healthz"
          port = 3000
        }
        period_seconds  = 30
        timeout_seconds = 3
      }
    }
  }

  labels = {
    environment = var.environment
    managed-by  = "terraform"
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

# Allow unauthenticated access to Cloud Run dev (auth handled by the app)
resource "google_cloud_run_v2_service_iam_member" "eulard_dev_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.eulard_dev.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# -----------------------------------------------------------------------------
# Data Sources — Existing Infrastructure
# -----------------------------------------------------------------------------

data "google_sql_database_instance" "existing" {
  name    = var.cloudsql_instance_name
  project = var.project_id
}
