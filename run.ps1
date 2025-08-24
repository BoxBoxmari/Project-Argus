# ===== INDUSTRIAL POWERSHELL AUTOMATION =====
# Đảm bảo UTF-8 encoding cho tất cả operations
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
chcp 65001 | Out-Null

# Luôn tạo run folder riêng với timestamp
$TS = Get-Date -Format 'yyyyMMdd_HHmmss'
$RUN = Join-Path $PWD "argus_run_$TS"
New-Item -ItemType Directory -Path $RUN -Force | Out-Null
Write-Host "🚀 Created isolated run: $RUN" -ForegroundColor Green
Set-Location $RUN

# Chạy bulletproof collector với full logging
Write-Host "⚡ Executing bulletproof collector..." -ForegroundColor Cyan
$StartTime = Get-Date
node ..\test_runner.mjs 2>&1 | Tee-Object -FilePath ps_run.log -Encoding UTF8
$Duration = (Get-Date) - $StartTime
Write-Host "⏱️  Execution time: $($Duration.TotalSeconds)s" -ForegroundColor Yellow

# Kiểm tra file output với comprehensive validation
Write-Host "🔍 Validating output files..." -ForegroundColor Cyan

# Sau khi fail, xuất thêm artifacts để xem DOM thực tế
if (!(Test-Path .\reviews.json)) {
  Write-Error "❌ reviews.json not found. Check logs:"
  if (Test-Path .\ps_run.log) { 
    Write-Host "`n📋 Last 20 lines of ps_run.log:`n"
    Get-Content .\ps_run.log -Tail 20 | Write-Host 
  }
  if (Test-Path .\events.jsonl) { 
    Write-Host "`n📋 Events summary:`n"
    (Get-Content .\events.jsonl | ConvertFrom-Json | Group-Object type | Select-Object Name,Count | Format-Table | Out-String) | Write-Host 
  }
  if (Test-Path .\fail_open_reviews.png) { 
    Write-Host "`n🖼  fail_open_reviews.png saved." 
  }
  if (Test-Path .\fail_open_reviews.html) { 
    Write-Host "📄  fail_open_reviews.html saved." 
  }
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
  
} catch {
  Write-Error "❌ Statistics generation failed: $_"
  exit 1
}
