#!/bin/bash
# Persist a verified builder manifest in guest attributes before shutting down.
set -euo pipefail
trap 'shutdown -h now' EXIT
python3 - <<'PY'
import pathlib,json,hashlib,urllib.request
log=pathlib.Path('/var/log/algostep-image-build.log').read_text(errors='replace')
result={'verified':'ALGOSTEP_IMAGE_BUILD_VERIFIED' in log,'digests':{}}
if result['verified']:
    for name in ['vmlinux','rootfs.ext4']:
        with open('/opt/algostep/'+name,'rb') as file:
            result['digests'][name]=hashlib.file_digest(file,'sha256').hexdigest() if hasattr(hashlib,'file_digest') else None
        if result['digests'][name] is None:
            digest=hashlib.sha256()
            with open('/opt/algostep/'+name,'rb') as file:
                for chunk in iter(lambda:file.read(1024*1024),b''):digest.update(chunk)
            result['digests'][name]=digest.hexdigest()
else:
    result['error']='VM verification did not complete successfully'
request=urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/instance/guest-attributes/algostep/build',data=json.dumps(result).encode(),headers={'Metadata-Flavor':'Google'},method='PUT')
urllib.request.urlopen(request,timeout=15).read()
print(json.dumps(result))
PY
