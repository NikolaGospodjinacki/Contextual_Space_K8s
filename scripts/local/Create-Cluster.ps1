# Create local k3d cluster for Contextual Space previews (PowerShell)
# Usage: .\Create-Cluster.ps1 [-ClusterName <NAME>]

param(
    [Parameter(Mandatory=$false)]
    [string]$ClusterName = "pr-previews"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🔍 Checking for existing cluster '$ClusterName'..." -ForegroundColor Yellow

$clusterExists = wsl -d Ubuntu-24.04 -e bash -c "k3d cluster list | grep -q $ClusterName && echo 'exists'"

if ($clusterExists -eq "exists") {
    Write-Host "⚠️  Cluster '$ClusterName' already exists" -ForegroundColor Yellow
    $response = Read-Host "Delete and recreate? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "🗑️  Deleting existing cluster..." -ForegroundColor Red
        wsl -d Ubuntu-24.04 -e bash -c "k3d cluster delete $ClusterName"
    } else {
        Write-Host "Using existing cluster" -ForegroundColor Green
        exit 0
    }
}

Write-Host ""
Write-Host "🚀 Creating k3d cluster '$ClusterName'..." -ForegroundColor Cyan

# Create cluster with Traefik disabled (we use Nginx Ingress)
wsl -d Ubuntu-24.04 -e bash -c @"
k3d cluster create $ClusterName \
    --api-port 6550 \
    --port '8080:80@loadbalancer' \
    --port '8443:443@loadbalancer' \
    --k3s-arg '--disable=traefik@server:0' \
    --wait
"@

if ($LASTEXITCODE -ne 0) { throw "Cluster creation failed" }

Write-Host ""
Write-Host "⏳ Waiting for cluster to be ready..." -ForegroundColor Yellow
wsl -d Ubuntu-24.04 -e bash -c "kubectl wait --for=condition=ready node --all --timeout=120s"

Write-Host ""
Write-Host "📦 Installing Nginx Ingress Controller..." -ForegroundColor Yellow
wsl -d Ubuntu-24.04 -e bash -c "kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml"

Write-Host ""
Write-Host "⏳ Waiting for Nginx Ingress to be ready..." -ForegroundColor Yellow
wsl -d Ubuntu-24.04 -e bash -c "kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ Cluster '$ClusterName' is ready!                      ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║                                                            ║" -ForegroundColor Green
Write-Host "║   Access previews at: http://localhost:8080/pr-{N}/        ║" -ForegroundColor Green
Write-Host "║                                                            ║" -ForegroundColor Green
Write-Host "║   Deploy a preview:                                        ║" -ForegroundColor Green
Write-Host "║     .\Deploy-Preview.ps1 -PRNumber 1                       ║" -ForegroundColor Green
Write-Host "║                                                            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
