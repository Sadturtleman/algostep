variable "enable_workers" {
  type    = bool
  default = false
}

variable "worker_zone" {
  type    = string
  default = "us-central1-a"
}

variable "worker_image" {
  type        = string
  default     = ""
  description = "Immutable custom GCE image containing verified kernel/rootfs, node, Firecracker/jailer and runner dist."
}

variable "kernel_sha256" {
  type    = string
  default = ""
}

variable "rootfs_sha256" {
  type    = string
  default = ""
}

resource "google_compute_network" "workers" {
  count                   = var.enable_workers ? 1 : 0
  name                    = "algostep-workers"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "workers" {
  count         = var.enable_workers ? 1 : 0
  name          = "algostep-workers"
  region        = var.region
  network       = google_compute_network.workers[0].id
  ip_cidr_range = "10.42.0.0/24"
}

resource "google_service_account" "runner" {
  count      = var.enable_workers ? 1 : 0
  account_id = "algostep-runner"
}

resource "google_secret_manager_secret_iam_member" "runner_token" {


  count = var.enable_workers ? 1 : 0

  secret_id = var.secret_ids["RUNNER_TOKEN"]

  role = "roles/secretmanager.secretAccessor"

  member = "serviceAccount:${google_service_account.runner[0].email}"

}

resource "google_project_iam_custom_role" "fleet" {


  count = var.enable_workers ? 1 : 0

  role_id = "algostepWorkerPower"

  title = "Algostep worker power only"

  permissions = ["compute.instances.get", "compute.instances.start", "compute.instances.stop"]

}

resource "google_compute_instance" "worker" {


  count = var.enable_workers ? 2 : 0

  name = "algostep-worker-${count.index + 1}"

  machine_type = "n2-standard-2"

  zone = var.worker_zone

  desired_status = "TERMINATED"

  allow_stopping_for_update = true

  deletion_protection = true
  boot_disk {
    initialize_params {
      image = var.worker_image
      size  = 40
      type  = "pd-balanced"
    }

  }

  advanced_machine_features {
    enable_nested_virtualization = true
  }

  scheduling {
    automatic_restart   = false
    on_host_maintenance = "MIGRATE"
  }

  network_interface {


    subnetwork = google_compute_subnetwork.workers[0].id
    access_config {

    }
    # Ephemeral IPv4 is released on stop. No inbound firewall rule.

  }

  service_account {
    email  = google_service_account.runner[0].email
    scopes = ["cloud-platform"]
  }


  metadata = {

    enable-oslogin         = "TRUE"
    block-project-ssh-keys = "TRUE"
    algostep-api           = var.web_origin
    algostep-project       = var.project_id
    algostep-token-secret  = var.secret_ids["RUNNER_TOKEN"]
    algostep-kernel-sha256 = var.kernel_sha256
    algostep-rootfs-sha256 = var.rootfs_sha256

  }


  metadata_startup_script = file("${path.module}/worker-startup.sh")
  lifecycle {


    ignore_changes = [desired_status]
    precondition {
      condition     = length(var.worker_image) > 0 && can(regex("^[a-f0-9]{64}$", var.kernel_sha256)) && can(regex("^[a-f0-9]{64}$", var.rootfs_sha256))
      error_message = "Workers require an approved image and both SHA256 digests."
    }


  }


  depends_on = [google_secret_manager_secret_iam_member.runner_token]

}

resource "google_compute_instance_iam_member" "controller" {


  count = var.enable_workers ? 2 : 0

  project = var.project_id

  zone = var.worker_zone

  instance_name = google_compute_instance.worker[count.index].name

  role = google_project_iam_custom_role.fleet[0].name

  member = "serviceAccount:${google_service_account.api.email}"

}

output "worker_names" {
  value = google_compute_instance.worker[*].name
}
