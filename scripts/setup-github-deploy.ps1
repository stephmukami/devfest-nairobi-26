<#
One-time setup so GitHub Actions can deploy without a stored service account key.

Creates:
  - a "github-deployer" service account with only the roles the workflow needs
  - a Workload Identity pool + OIDC provider that trusts ONLY your GitHub repo
Safe to re-run: existing resources are left in place.

Usage (PowerShell, after `gcloud auth login`):
  .\scripts\setup-github-deploy.ps1 -ProjectId shippy-6b185 -Repo <github-user>/<repo-name>
#>
param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$Repo,   # e.g. stephmukami/devfest-2026
  [string]$Region = "europe-west1"
)

$ErrorActionPreference = "Stop"
function Run([string[]]$GcloudArgs) {
  & gcloud @GcloudArgs
  if ($LASTEXITCODE -ne 0) { throw "gcloud $($GcloudArgs -join ' ') failed" }
}
function Exists([string[]]$GcloudArgs) {
  $ErrorActionPreference = "Continue"
  & gcloud @GcloudArgs --quiet *> $null
  return $LASTEXITCODE -eq 0
}

$ProjectNumber = (& gcloud projects describe $ProjectId --format="value(projectNumber)").Trim()
$Deployer = "github-deployer@$ProjectId.iam.gserviceaccount.com"
$RuntimeSa = "$ProjectNumber-compute@developer.gserviceaccount.com"   # Cloud Run + Cloud Build default
$Pool = "github"
$Provider = "github-repo"

Write-Host "Enabling APIs..."
Run @("services", "enable", "--project", $ProjectId,
  "iamcredentials.googleapis.com", "sts.googleapis.com", "run.googleapis.com",
  "cloudbuild.googleapis.com", "artifactregistry.googleapis.com",
  "secretmanager.googleapis.com", "firebasehosting.googleapis.com")

Write-Host "Deployer service account..."
if (-not (Exists @("iam", "service-accounts", "describe", $Deployer, "--project", $ProjectId))) {
  Run @("iam", "service-accounts", "create", "github-deployer", "--project", $ProjectId,
    "--display-name", "GitHub Actions deployer")
}

Write-Host "Granting deployer roles..."
foreach ($role in @(
    "roles/run.sourceDeveloper",              # gcloud run deploy --source
    "roles/serviceusage.serviceUsageConsumer",
    "roles/firebasehosting.admin",            # firebase deploy --only hosting
    "roles/firebase.viewer"                   # firebase-tools reads project metadata
  )) {
  Run @("projects", "add-iam-policy-binding", $ProjectId, "--member", "serviceAccount:$Deployer",
    "--role", $role, "--condition", "None", "--quiet") | Out-Null
}
# Let the deployer deploy services that run as the default compute service account.
Run @("iam", "service-accounts", "add-iam-policy-binding", $RuntimeSa, "--project", $ProjectId,
  "--member", "serviceAccount:$Deployer", "--role", "roles/iam.serviceAccountUser", "--quiet") | Out-Null

Write-Host "Workload Identity pool and provider..."
if (-not (Exists @("iam", "workload-identity-pools", "describe", $Pool, "--project", $ProjectId, "--location", "global"))) {
  Run @("iam", "workload-identity-pools", "create", $Pool, "--project", $ProjectId,
    "--location", "global", "--display-name", "GitHub Actions")
}
if (-not (Exists @("iam", "workload-identity-pools", "providers", "describe", $Provider, "--project", $ProjectId,
      "--location", "global", "--workload-identity-pool", $Pool))) {
  Run @("iam", "workload-identity-pools", "providers", "create-oidc", $Provider, "--project", $ProjectId,
    "--location", "global", "--workload-identity-pool", $Pool,
    "--display-name", "GitHub repo",
    "--issuer-uri", "https://token.actions.githubusercontent.com",
    "--attribute-mapping", "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref",
    "--attribute-condition", "assertion.repository == '$Repo'")
}

Write-Host "Allowing $Repo to impersonate the deployer..."
$Principal = "principalSet://iam.googleapis.com/projects/$ProjectNumber/locations/global/workloadIdentityPools/$Pool/attribute.repository/$Repo"
Run @("iam", "service-accounts", "add-iam-policy-binding", $Deployer, "--project", $ProjectId,
  "--role", "roles/iam.workloadIdentityUser", "--member", $Principal, "--quiet") | Out-Null

$ProviderName = "projects/$ProjectNumber/locations/global/workloadIdentityPools/$Pool/providers/$Provider"

Write-Host ""
Write-Host "Done. Add these in GitHub > Settings > Secrets and variables > Actions:" -ForegroundColor Green
Write-Host ""
Write-Host "Variables:"
Write-Host "  GCP_PROJECT_ID                = $ProjectId"
Write-Host "  GCP_REGION                    = $Region"
Write-Host "  GCP_WIF_PROVIDER              = $ProviderName"
Write-Host "  GCP_DEPLOY_SA                 = $Deployer"
Write-Host "  GEMINI_MODEL                  = gemini-2.5-flash   (optional)"
Write-Host "  MIN_INSTANCES                 = 0                  (optional; 1 on talk day)"
Write-Host "  FIREBASE_API_KEY              = <from Firebase web app config>"
Write-Host "  FIREBASE_MESSAGING_SENDER_ID  = <from Firebase web app config>"
Write-Host "  FIREBASE_APP_ID               = <from Firebase web app config>"
Write-Host "  FIREBASE_VAPID_KEY            = <Cloud Messaging > Web Push certificates>"
Write-Host ""
Write-Host "Secrets:"
Write-Host "  DEMO_KEY                      = <your demo key>"
Write-Host ""
Write-Host "Or with the GitHub CLI, e.g.:  gh variable set GCP_WIF_PROVIDER --body `"$ProviderName`""
