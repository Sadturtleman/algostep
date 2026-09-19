"""Create a source-only deployment archive. Never include ignored credentials."""
import pathlib, subprocess, tarfile
root=pathlib.Path(__file__).resolve().parents[1]
files=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=root).decode().split('\0')
target=root/'tmp'/'algostep-source.tar.gz'
target.parent.mkdir(exist_ok=True)
with tarfile.open(target,'w:gz') as archive:
    for name in sorted(set(files)):
        if not name or name.startswith(('docs/','apps/android/','.github/')): continue
        path=root/name
        if path.is_file(): archive.add(path,arcname=name)
print(target)
