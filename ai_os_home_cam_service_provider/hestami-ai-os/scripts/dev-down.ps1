# Stop development infrastructure
# Usage: .\scripts\dev-down.ps1

Write-Host "Stopping development infrastructure..." -ForegroundColor Cyan

docker compose down

Write-Host "Development infrastructure stopped." -ForegroundColor Green
