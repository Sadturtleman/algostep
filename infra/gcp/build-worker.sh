#!/bin/bash
# One-shot image builder on a disposable Ubuntu 22.04 N2 VM. No application secrets.
set -euo pipefail
exec > >(tee /var/log/algostep-image-build.log /dev/ttyS0) 2>&1
trap 'echo ALGOSTEP_IMAGE_BUILD_FAILED; shutdown -h now' ERR
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io build-essential flex bison libelf-dev libssl-dev bc python3 curl xz-utils
systemctl start docker
mkdir -p /opt/algostep /tmp/algostep-build
cd /tmp/algostep-build
python3 - <<'PY'
import urllib.request,json
def get(url,headers={}):
    return urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=60).read()
base='http://metadata.google.internal/computeMetadata/v1/'
headers={'Metadata-Flavor':'Google'}
token=json.loads(get(base+'instance/service-accounts/default/token',headers))['access_token']
source=get(base+'instance/attributes/algostep-source',headers).decode()
open('source.tar.gz','wb').write(get(source,{'Authorization':'Bearer '+token}))
PY
tar -xzf source.tar.gz -C /opt/algostep
node_version=v24.19.0
curl -fsSLO "https://nodejs.org/dist/$node_version/node-$node_version-linux-x64.tar.xz"
curl -fsSLO "https://nodejs.org/dist/$node_version/SHASUMS256.txt"
grep " node-$node_version-linux-x64.tar.xz$" SHASUMS256.txt | sha256sum -c -
tar -xJf "node-$node_version-linux-x64.tar.xz" --strip-components=1 -C /usr/local
fc=https://github.com/firecracker-microvm/firecracker/releases/download/v1.17.0
curl -fsSLO "$fc/firecracker-v1.17.0-x86_64.tgz"
curl -fsSLO "$fc/firecracker-v1.17.0-x86_64.tgz.sha256.txt"
sha256sum -c firecracker-v1.17.0-x86_64.tgz.sha256.txt
tar -xzf firecracker-v1.17.0-x86_64.tgz
install release-v1.17.0-x86_64/firecracker-v1.17.0-x86_64 /usr/local/bin/firecracker
install release-v1.17.0-x86_64/jailer-v1.17.0-x86_64 /usr/local/bin/jailer
curl -fsSLO https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-6.1.188.tar.xz
echo 'ed4d0acb1307c235230c89efc094e210e6290593f94a7e617f28b1001101a33a  linux-6.1.188.tar.xz' | sha256sum -c -
tar -xJf linux-6.1.188.tar.xz
cd linux-6.1.188
curl -fsSL https://raw.githubusercontent.com/firecracker-microvm/firecracker/v1.17.0/resources/guest_configs/microvm-kernel-ci-x86_64-6.1.config -o .config
make olddefconfig
make -j2 vmlinux
install -m 0444 vmlinux /opt/algostep/vmlinux
cd /opt/algostep
npm ci
npm run build -w apps/runner
bash apps/runner/build-rootfs.sh
mv apps/runner/images/rootfs.ext4 /opt/algostep/rootfs.ext4
chmod 0444 rootfs.ext4
test -c /dev/kvm
env KERNEL_PATH=/opt/algostep/vmlinux ROOTFS_PATH=/opt/algostep/rootfs.ext4 RUNNER_WORKDIR=/var/lib/algostep node --import tsx scripts/vm-smoke.ts
sha256sum vmlinux rootfs.ext4 | tee /opt/algostep/image-sha256.txt
echo ALGOSTEP_IMAGE_BUILD_VERIFIED
# Only build temporaries beneath these fixed image-builder directories are removed.
rm -rf /tmp/algostep-build /opt/algostep/apps/runner/images
docker image rm algostep-guest:local
systemctl disable --now docker.service docker.socket
shutdown -h now
