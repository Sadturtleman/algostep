"""Initialize only missing Algostep secrets; never print or persist secret values."""
import pathlib,subprocess,sys,secrets
sdk=pathlib.Path(__file__).resolve().parents[1]/'tmp/gcloud/google-cloud-sdk/lib/gcloud.py'
def run(*args,data=None,check=True):
    result=subprocess.run([sys.executable,str(sdk),*args,'--project=algostep','--quiet'],input=data,text=True,capture_output=True)
    if check and result.returncode: raise RuntimeError('GCP operation failed: '+args[0]+' '+args[1])
    return result
for name in ['algostep-session-secret','algostep-runner-token','algostep-operations-token']:
    exists=run('secrets','describe',name,check=False).returncode==0
    if exists:
        print(name+': already exists; not rotated')
        continue
    run('secrets','create',name,'--replication-policy=automatic')
    run('secrets','versions','add',name,'--data-file=-',data=secrets.token_urlsafe(48))
    print(name+': created (value hidden)')
if '--include-gemini' in sys.argv:
    name='algostep-gemini-api-key'
    if run('secrets','describe',name,check=False).returncode==0:
        print(name+': already exists; not rotated')
    else:
        key=run('services','api-keys','get-key-string','e22ef204-5116-4783-9de5-ba90020840b1','--location=global','--format=value(keyString)').stdout.strip()
        if not key: raise RuntimeError('Existing API key unavailable')
        run('secrets','create',name,'--replication-policy=automatic')
        run('secrets','versions','add',name,'--data-file=-',data=key)
        print(name+': copied (value hidden)')
