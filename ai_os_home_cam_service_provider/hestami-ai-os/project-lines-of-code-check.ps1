param([string]$FilePath)

$srcPath = if ($FilePath) { $FilePath } else { Join-Path $PSScriptRoot "src/lib" }
# These patterns match your sonar-project.properties exclusions
$excludePatterns = @(
    "node_modules",
    "\.svelte-kit",
    "build",
    "3rdParty",
    "generated",
    "\.generated\.ts$",
    "types\.generated\.ts$",
    "\.json$",
    "\.csv$",
    "openapi\.json$"
)

Write-Host "Analyzing files in $srcPath (matching sonar.sources)..." -ForegroundColor Cyan

$items = if (Test-Path -LiteralPath $srcPath -PathType Leaf) {
    Get-Item -LiteralPath $srcPath
} else {
    Get-ChildItem -LiteralPath $srcPath -Recurse -File
}

$files = $items | Where-Object {
    $isExcluded = $false
    foreach ($pattern in $excludePatterns) {
        if ($_.FullName -match $pattern) {
            $isExcluded = $true
            break
        }
    }
    -not $isExcluded
}

$stats = $files | ForEach-Object {
    $lineCount = (Get-Content -LiteralPath $_.FullName | Measure-Object -Line).Lines
    [PSCustomObject]@{
        RelativePath = $_.FullName.Replace($PSScriptRoot, "")
        Lines = $lineCount
        Extension = $_.Extension
    }
}

Write-Host "`n--- Top 20 Largest Files (Handwritten) ---" -ForegroundColor Yellow
$stats | Sort-Object Lines -Descending | Select-Object -First 20 | Format-Table -AutoSize

$totalLines = int.Sum
$totalFiles = $stats.Count

Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "Total Files Scanned: $totalFiles"
Write-Host "Total Lines of Code: $totalLines"

# Breakdown by extension
Write-Host "`n--- Breakdown by Extension ---" -ForegroundColor Yellow
$stats | Group-Object Extension | Select-Object Name, @{Name="Count"; Expression={$_.Count}}, @{Name="TotalLines"; Expression={int.Sum}} | Sort-Object TotalLines -Descending | Format-Table -AutoSize

if ($totalLines -gt 100000) {
    Write-Host "WARNING: You are still over the 100k SonarCloud limit!" -ForegroundColor Red
} else {
    Write-Host "SUCCESS: Your handwritten code is under the limit." -ForegroundColor Green
}
