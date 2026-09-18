"""Official Firecracker CI kernel for smoke testing only, not a production image."""
import urllib.request, xml.etree.ElementTree as ET, re, pathlib, hashlib
base='https://s3.amazonaws.com/spec.ccfc.min'
ns={'s':'http://s3.amazonaws.com/doc/2006-03-01/'}
def listing(query):
    with urllib.request.urlopen(base+'?list-type=2&'+query,timeout=30) as r:return ET.fromstring(r.read())
prefixes=[e.text for e in listing('prefix=firecracker-ci/&delimiter=/').findall('.//s:CommonPrefixes/s:Prefix',ns)]
prefix=sorted(p for p in prefixes if re.fullmatch(r'firecracker-ci/\d{8}-[^/]+/',p))[-1]
keys=[e.text for e in listing('prefix='+prefix+'x86_64/vmlinux-').findall('.//s:Key',ns)]
key=sorted((k for k in keys if re.search(r'/vmlinux-6\.1\.\d+$',k)),key=lambda k:int(k.rsplit('.',1)[1]))[-1]
target=pathlib.Path('apps/runner/images/vmlinux');target.parent.mkdir(parents=True,exist_ok=True)
with urllib.request.urlopen(base+'/'+key,timeout=60) as r:target.write_bytes(r.read())
print('Smoke-test kernel:',key,'sha256:',hashlib.sha256(target.read_bytes()).hexdigest())
