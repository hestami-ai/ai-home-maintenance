# Generate S3-compatible credentials (alphanumeric only, no special characters)
# AWS access keys must not contain / or + as they break signature parsing

param(
    [int]$AccessKeyLength = 20,
    [int]$SecretKeyLength = 40
)

function Generate-AlphanumericKey {
    param([int]$Length)
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    -join (1..$Length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

$accessKey = Generate-AlphanumericKey -Length $AccessKeyLength
$secretKey = Generate-AlphanumericKey -Length $SecretKeyLength

Write-Host ""
Write-Host "Generated S3 Credentials (alphanumeric only):" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "S3_ACCESS_KEY=$accessKey" -ForegroundColor Green
Write-Host "S3_SECRET_KEY=$secretKey" -ForegroundColor Green
Write-Host ""
Write-Host "Copy these values to your .env file." -ForegroundColor Yellow
Write-Host "Then restart SeaweedFS S3 and tusd:" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose.yml up -d --force-recreate seaweedfs-s3 tusd" -ForegroundColor White
Write-Host ""
