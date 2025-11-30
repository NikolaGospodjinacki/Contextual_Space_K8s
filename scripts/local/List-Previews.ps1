# List all preview environments (PowerShell)
# Usage: .\List-Previews.ps1

Write-Host ""
Write-Host "📋 Active Preview Environments" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$namespaces = wsl -d Ubuntu-24.04 -e bash -c "kubectl get namespaces -o name | grep 'namespace/pr-' | sed 's/namespace\///'"

if ([string]::IsNullOrEmpty($namespaces)) {
    Write-Host "No preview environments found." -ForegroundColor Yellow
    exit 0
}

foreach ($ns in $namespaces -split "`n") {
    if ([string]::IsNullOrEmpty($ns)) { continue }
    
    $prNum = $ns -replace "pr-", ""
    Write-Host "🔹 PR #$prNum" -ForegroundColor Green
    Write-Host "   URL: http://localhost:8080/$ns/" -ForegroundColor White
    Write-Host "   Pods:" -ForegroundColor White
    
    $pods = wsl -d Ubuntu-24.04 -e bash -c "kubectl get pods -n $ns --no-headers 2>/dev/null"
    foreach ($pod in $pods -split "`n") {
        if (![string]::IsNullOrEmpty($pod)) {
            Write-Host "      $pod" -ForegroundColor Gray
        }
    }
    Write-Host ""
}
