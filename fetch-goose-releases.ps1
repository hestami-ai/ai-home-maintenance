param(
    [string]$Owner = "aaif-goose",
    [string]$Repo = "goose",
    [string]$OutFile = "E:\Projects\hestami-ai\goose-releases.jsonl"
)

$headers = @{
    "Accept" = "application/vnd.github+json"
    "User-Agent" = "PowerShell-Goose-Release-Fetcher"
}

if ($env:GITHUB_TOKEN) {
    $headers["Authorization"] = "Bearer $env:GITHUB_TOKEN"
}

if (Test-Path $OutFile) {
    Remove-Item $OutFile -Force
}

$page = 1
$total = 0

while ($true) {
    $url = "https://api.github.com/repos/$Owner/$Repo/releases?per_page=100&page=$page"
    Write-Host "Fetching page ${page}: $url"

    $batch = Invoke-RestMethod -Uri $url -Headers $headers -Method Get

    if ($null -eq $batch) {
        break
    }

    if ($batch -isnot [System.Array]) {
        $batch = @($batch)
    }

    if ($batch.Count -eq 0) {
        break
    }

    foreach ($release in $batch) {
        $record = [ordered]@{
            repo         = "$Owner/$Repo"
            id           = $release.id
            tag_name     = $release.tag_name
            name         = $release.name
            draft        = $release.draft
            prerelease   = $release.prerelease
            created_at   = $release.created_at
            published_at = $release.published_at
            html_url     = $release.html_url
            api_url      = $release.url
            body         = $release.body
            assets       = @($release.assets | ForEach-Object {
                [ordered]@{
                    id                   = $_.id
                    name                 = $_.name
                    content_type         = $_.content_type
                    size                 = $_.size
                    download_count       = $_.download_count
                    browser_download_url = $_.browser_download_url
                }
            })
        }

        $record | ConvertTo-Json -Depth 8 -Compress | Add-Content -Path $OutFile
        $total++
    }

    $page++
}

Write-Host "Done. Wrote $total releases to $OutFile"
