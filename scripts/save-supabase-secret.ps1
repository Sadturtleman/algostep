param(
  [Parameter(Mandatory=$true)][string]$Project,
  [string]$SecretName = 'algostep-database-url',
  [string]$Python = 'python',
  [string]$Gcloud = "$PSScriptRoot/../tmp/gcloud/google-cloud-sdk/lib/gcloud.py"
)
$ErrorActionPreference = 'Stop'
# Run in an interactive terminal. Neither the password nor URL is written to disk.
$password = Read-Host 'Supabase database password (hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
try {
  $encoded = [Uri]::EscapeDataString([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer))
  $connection = "postgresql://postgres.qsrxfuybohxdoqrxrsko:${encoded}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=verify-full"
  & $Python $Gcloud secrets describe $SecretName --project=$Project --format='value(name)' 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    & $Python $Gcloud secrets create $SecretName --project=$Project --replication-policy=automatic
    if ($LASTEXITCODE -ne 0) { throw 'Secret creation failed; no credential was saved.' }
  }
  $connection | & $Python $Gcloud secrets versions add $SecretName --project=$Project --data-file=-
  if ($LASTEXITCODE -ne 0) { throw 'Secret upload failed.' }
  Write-Host "Saved Secret Manager version: $SecretName (value hidden)."
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $connection = $null
  $encoded = $null
  $password.Dispose()
}
