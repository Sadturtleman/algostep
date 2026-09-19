terraform {

  required_version = ">= 1.6"
  required_providers {
    google = {
      source = "hashicorp/google", version = "~> 6.0"
    }

  }


}

provider "google" {
  project = var.project_id
  region  = var.region

}

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"

}

variable "web_origin" {
  type = string
  validation {
    condition     = can(regex("^https://[^/]+$", var.web_origin))
    error_message = "An HTTPS origin without a trailing slash is required."

  }


}

variable "image" {
  type = string
}

variable "google_client_id" {
  type = string
}

variable "secret_ids" {

  description = "Existing Secret Manager secret names keyed by DATABASE_URL, SESSION_SECRET, RUNNER_TOKEN, OPERATIONS_TOKEN; optionally GEMINI_API_KEY. Never pass secret values."
  type        = map(string)
  validation {
    condition     = alltrue([for k in ["DATABASE_URL", "SESSION_SECRET", "RUNNER_TOKEN", "OPERATIONS_TOKEN"] : contains(keys(var.secret_ids), k)])
    error_message = "All required secret names must be provided."

  }


}

resource "google_service_account" "api" {
  account_id = "algostep-api"
}

resource "google_service_account" "scheduler" {
  account_id = "algostep-scheduler"
}

resource "google_storage_bucket" "traces" {

  name                        = "${var.project_id}-algostep-traces"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning {
    enabled = false
  }

  soft_delete_policy {
    retention_duration_seconds = 0
  }

  lifecycle_rule {
    condition {
      age = 30
    }

    action {
      type = "Delete"
    }


  }


}

resource "google_storage_bucket_iam_member" "api_objects" {
  bucket = google_storage_bucket.traces.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.api.email}"

}

resource "google_secret_manager_secret_iam_member" "api_secret" {

  for_each  = toset(values(var.secret_ids))
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"

}

resource "google_cloud_run_v2_service" "api" {

  name                = "algostep"
  location            = var.region
  deletion_protection = true
  scaling {
    min_instance_count = 0
  }
  template {

    service_account                  = google_service_account.api.email
    timeout                          = "180s"
    max_instance_request_concurrency = 16
    scaling {
      min_instance_count = 0
      max_instance_count = 2

    }

    containers {

      image = var.image
      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu = "1", memory = "2Gi"
        }

        cpu_idle          = true
        startup_cpu_boost = false

      }

      dynamic "env" {
        for_each = merge({
          WEB_ORIGIN = var.web_origin, GOOGLE_CLIENT_ID = var.google_client_id, TRACE_BUCKET = google_storage_bucket.traces.name, BACKGROUND_WORKER = "false", SCHEDULER_AUDIENCE = var.web_origin, SCHEDULER_EMAIL = google_service_account.scheduler.email, LLM_PROVIDER = "gemini", GEMINI_MODEL = "gemini-3.8-flash", GEMINI_BACKEND = "vertex-express", DATABASE_SCHEMA = "algostep", DATABASE_SSL_CA = "/app/certs/supabase-ca.crt", GCP_PROJECT = var.project_id, WORKER_AUTOSCALE = tostring(var.enable_workers), WORKER_ZONE = var.worker_zone, WORKER_NAMES = "algostep-worker-1,algostep-worker-2", WORKER_IDLE_SECONDS = "900", RUNNER_SLOTS_PER_HOST = "2"
          }
        )
        content {
          name  = env.key
          value = env.value

        }


      }

      dynamic "env" {
        for_each = var.secret_ids
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"

            }

          }


        }


      }


    }


  }

  depends_on = [google_secret_manager_secret_iam_member.api_secret]

}

resource "google_cloud_run_v2_service_iam_member" "public_web" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"

}

resource "google_cloud_scheduler_job" "maintenance" {

  name             = "algostep-maintenance"
  schedule         = "* * * * *"
  time_zone        = "Asia/Seoul"
  attempt_deadline = "180s"
  http_target {

    uri         = "${var.web_origin}/api/operations/maintenance"
    http_method = "POST"
    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = var.web_origin

    }


  }


}

output "service_url" {
  value = google_cloud_run_v2_service.api.uri
}
