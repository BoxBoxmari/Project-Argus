# ===== DEMO SUCCESSFUL COLLECTION =====
# Đảm bảo UTF-8 encoding cho tất cả operations
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
chcp 65001 | Out-Null

# Tạo run folder riêng với timestamp
$TS = Get-Date -Format 'yyyyMMdd_HHmmss'
$RUN = Join-Path $PWD "argus_demo_$TS"
New-Item -ItemType Directory -Path $RUN -Force | Out-Null
Write-Host "🚀 Created demo run: $RUN" -ForegroundColor Green
Set-Location $RUN

# Tạo mock data để demo PowerShell automation
Write-Host "⚡ Creating demo data..." -ForegroundColor Cyan
$StartTime = Get-Date

# Mock reviews data
$mockReviews = @(
  @{
    review_id = "ChZDSUhNMG9nS0VJQ0FnSUR2"
    author = "John Doe"
    rating = 5
    text = "Excellent coffee and great atmosphere!"
    relative_time = "2 months ago"
  },
  @{
    review_id = "ChZDSUhNMG9nS0VJQ0FnSUR2_2"
    author = "Jane Smith"
    rating = 4
    text = "Good service, nice location for work meetings."
    relative_time = "1 month ago"
  },
  @{
    review_id = "ChZDSUhNMG9nS0VJQ0FnSUR2_3"
    author = "Mike Johnson"
    rating = $null
    text = "The wifi is reliable and staff is friendly."
    relative_time = "3 weeks ago"
  }
)

# Mock summary
$mockSummary = @{
  url = "https://www.google.com/maps/place/Highlands+Coffee+417+Dien+Bien+Phu/?hl=en"
  timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  scrolled = @{
    containers = 1
    totalScroll = 15
    before = 0
    after = 3
  }
  reviews_collected = $mockReviews.Count
}

# Mock events
$mockEvents = @(
  @{ type = "launch_ok"; browser = "chrome" },
  @{ type = "open_reviews"; ok = $true },
  @{ type = "resolve_container_ok"; itemSel = "div[data-review-id]" },
  @{ type = "set_sort_ok"; reason = $null },
  @{ type = "collected"; count = $mockReviews.Count }
)

# Ghi mock files với UTF-8 encoding
$mockReviews | ConvertTo-Json -Depth 10 | Set-Content reviews.json -Encoding UTF8
$mockSummary | ConvertTo-Json -Depth 10 | Set-Content summary.json -Encoding UTF8
$mockEvents | ForEach-Object { $_ | ConvertTo-Json -Compress | Add-Content events.jsonl -Encoding UTF8 }

$Duration = (Get-Date) - $StartTime
Write-Host "⏱️  Demo data creation time: $($Duration.TotalSeconds)s" -ForegroundColor Yellow

# Validation (same as run.ps1)
Write-Host "🔍 Validating output files..." -ForegroundColor Cyan

if (!(Test-Path .\reviews.json)) {
  Write-Error "❌ reviews.json not found"
  exit 1
}

Write-Host "✅ reviews.json found" -ForegroundColor Green

# Thống kê đáng tin cậy với data validation
Write-Host "📊 Generating statistics..." -ForegroundColor Cyan

try {
  $sum = Get-Content .\summary.json | ConvertFrom-Json
  $reviews = Get-Content .\reviews.json -Raw | ConvertFrom-Json
  $sizeKB = [math]::Round((Get-Item .\reviews.json).Length/1KB,1)
  
  # Industrial-grade statistics
  Write-Host "📈 COLLECTION RESULTS:" -ForegroundColor Green
  Write-Host "   Before scroll: $($sum.scrolled.before) reviews" -ForegroundColor White
  Write-Host "   After scroll:  $($sum.scrolled.after) reviews" -ForegroundColor White  
  Write-Host "   File size:     $sizeKB KB" -ForegroundColor White
  Write-Host "   Collected:     $($reviews.Count) reviews" -ForegroundColor Green
  Write-Host "   Duration:      $($Duration.TotalSeconds)s" -ForegroundColor White
  
  # Validate data quality
  $withRating = ($reviews | Where-Object { $_.rating -ne $null }).Count
  $withText = ($reviews | Where-Object { $_.text -and $_.text.Length -gt 0 }).Count
  Write-Host "   With rating:   $withRating/$($reviews.Count)" -ForegroundColor Cyan
  Write-Host "   With text:     $withText/$($reviews.Count)" -ForegroundColor Cyan

  # Xuất UTF-8 CSV với proper encoding
  Write-Host "💾 Exporting to UTF-8 CSV..." -ForegroundColor Cyan
  $reviews | ConvertTo-Csv -NoTypeInformation | Set-Content reviews.csv -Encoding UTF8
  $csvSizeKB = [math]::Round((Get-Item .\reviews.csv).Length/1KB,1)
  Write-Host "✅ reviews.csv exported ($csvSizeKB KB)" -ForegroundColor Green
  
  Write-Host "🎉 DEMO COMPLETED SUCCESSFULLY!" -ForegroundColor Green
  
} catch {
  Write-Error "❌ Statistics generation failed: $_"
  exit 1
}
