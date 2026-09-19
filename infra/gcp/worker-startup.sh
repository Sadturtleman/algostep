#!/bin/bash
set -euo pipefail
umask 077
# The immutable host image must already contain binaries and guest images.
# Do not install packages or download mutable source on every cold start.
test -c /dev/kvm
test -x /usr/local/bin/firecracker
test -x /usr/local/bin/jailer
test -f /opt/algostep/apps/runner/dist/index.js
python3 - <<'PY'
import urllib.request,json,pathlib
def request(url,headers):
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=15) as r:return r.read()
base='http://metadata.google.internal/computeMetadata/v1/'
headers={'Metadata-Flavor':'Google'}
def meta(path):return request(base+path,headers).decode()
project=meta('instance/attributes/algostep-project')
secret=meta('instance/attributes/algostep-token-secret')
token=json.loads(meta('instance/service-accounts/default/token'))['access_token']
import base64
payload=json.loads(request(f'https://secretmanager.googleapis.com/v1/projects/{project}/secrets/{secret}/versions/latest:access',{'Authorization':'Bearer '+token}))
runner_token=base64.b64decode(payload['payload']['data']).decode()
values={'NODE_ENV':'production','API_URL':meta('instance/attributes/algostep-api'),'RUNNER_TOKEN':runner_token,'WORKER_NAME':meta('instance/name'),'RUNNER_SLOTS':'2','KERNEL_PATH':'/opt/algostep/vmlinux','ROOTFS_PATH':'/opt/algostep/rootfs.ext4','KERNEL_SHA256':meta('instance/attributes/algostep-kernel-sha256'),'ROOTFS_SHA256':meta('instance/attributes/algostep-rootfs-sha256'),'RUNNER_WORKDIR':'/var/lib/algostep','JAILER_UID':'1001','JAILER_GID':'1001'}
if any('\n' in v or '\r' in v or '"' in v or '\\' in v for v in values.values()):raise RuntimeError('Invalid environment value')
p=pathlib.Path('/run/algostep.env');p.write_text('\n'.join(k+'="'+v+'"' for k,v in values.items())+'\n');p.chmod(0o600)
PY
cat >/etc/systemd/system/algostep-runner.service <<'UNIT'
[Unit]
Description=Algostep isolated worker
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
WorkingDirectory=/opt/algostep
EnvironmentFile=/run/algostep.env
ExecStart=/usr/local/bin/node /opt/algostep/apps/runner/dist/index.js
Restart=on-failure
RestartSec=10
TimeoutStopSec=150
KillMode=mixed
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl start algostep-runner
