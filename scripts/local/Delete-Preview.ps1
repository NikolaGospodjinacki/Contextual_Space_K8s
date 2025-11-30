# Delete a preview environment (PowerShell)
# Usage: .\Delete-Preview.ps1 -PRNumber <NUMBER>

param(
    [Parameter(Mandatory=$true)]
    [int]$PRNumber
)

$Namespace = "pr-$PRNumber"
$PRPath = "pr-$PRNumber"

Write-Host ""
Write-Host "🗑️  Deleting preview for PR #$PRNumber..." -ForegroundColor Yellow

$namespaceExists = wsl -d Ubuntu-24.04 -e bash -c "kubectl get namespace $Namespace 2>/dev/null && echo 'exists'"

if ($namespaceExists -match "exists") {
    wsl -d Ubuntu-24.04 -e bash -c "kubectl delete namespace $Namespace"
    Write-Host "✅ Namespace $Namespace deleted" -ForegroundColor Green
} else {
    Write-Host "⚠️  Namespace $Namespace does not exist" -ForegroundColor Yellow
}

# Clean up Docker images
Write-Host ""
Write-Host "🧹 Cleaning up Docker images..." -ForegroundColor Yellow
docker rmi "contextual-space-frontend:$PRPath" 2>$null
docker rmi "contextual-space-backend:$PRPath" 2>$null

Write-Host ""
Write-Host "✅ Preview for PR #$PRNumber cleaned up" -ForegroundColor Green
