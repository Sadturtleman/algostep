"""Run Terraform using the active gcloud login without persisting access tokens."""
import os,pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
sdk=root/'tmp/gcloud/google-cloud-sdk/lib/gcloud.py'
token=subprocess.run([sys.executable,str(sdk),'auth','print-access-token'],text=True,capture_output=True,check=True).stdout.strip()
env={**os.environ,'GOOGLE_OAUTH_ACCESS_TOKEN':token}
result=subprocess.run([str(root/'tmp/terraform/terraform.exe'),'-chdir='+str(root/'infra/gcp'),*sys.argv[1:]],env=env)
sys.exit(result.returncode)
