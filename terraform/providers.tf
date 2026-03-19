terraform {
  required_version = "~> 1.11"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.45"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.8"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
