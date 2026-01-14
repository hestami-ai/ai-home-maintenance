# run_all_checks.ps1
# Runs all governance checks and redirects output to individual files.

$checks = @(
    "boundaries",
    "mutations",
    "types",
    "pipelines",
    "errors",
    "policies",
    "timestamps",
    "security",
    "trace"
)

# Create output directory if it doesn't exist
$outputDir = "check_results"
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir
}

Write-Host "Starting Governance Checks..." -ForegroundColor Cyan

foreach ($check in $checks) {
    $outputFile = "$outputDir/$check.txt"
    Write-Host "Running check: $check..." -NoNewline
    
    # Run the check and redirect both stdout and stderr to the file
    # We use 'bun run src/cli.ts verify' to execute the CLI
    try {
        & bun run src/cli.ts verify $check > $outputFile 2>&1
        Write-Host " Done. (Results in $outputFile)" -ForegroundColor Green
    } catch {
        Write-Host " Failed." -ForegroundColor Red
        Write-Error $_
    }
}

Write-Host "`nAll checks completed. See the '$outputDir' directory for detailed reports." -ForegroundColor Cyan
