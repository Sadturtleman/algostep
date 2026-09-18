#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p images
docker build -t algostep-guest:local guest
container=$(docker create algostep-guest:local)
trap 'docker rm "$container" >/dev/null' EXIT
docker export "$container" > images/rootfs.tar
mkdir -p images/root
tar --no-same-owner -xf images/rootfs.tar -C images/root
truncate -s 3G images/rootfs.ext4
mkfs.ext4 -F -d images/root images/rootfs.ext4
printf 'Root filesystem created. Supply a verified Firecracker-compatible Linux kernel separately.\n'
