$APM_URL = "https://mahidol.ac.th/aqireport/data/APM.json"
$GAS_URL = "https://script.google.com/macros/s/AKfycbyG1aEjY8weKwDRxyM2Wj_jO8UScw_wD7gcpgcKJzUjdYRykAQEs8VzVExlWqOtTY3NUA/exec"

$headers = @{
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    "Referer"    = "https://mahidol.ac.th/aqireport/"
}

try {
    Write-Host "กำลังดึงข้อมูลสภาพอากาศจาก Mahidol APM.json..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri $APM_URL -Method Get -Headers $headers -TimeoutSec 15
    Write-Host "ดึงข้อมูลสำเร็จ พบข้อมูล: $($response.Count) รายการ" -ForegroundColor Green

    # แปลงก้อนข้อมูลให้อยู่ในโครงสร้าง action sync_air_data
    $bodyObj = @{
        action  = "sync_air_data"
        airData = $response
    }
    $jsonPayload = $bodyObj | ConvertTo-Json -Depth 10 -Compress

    Write-Host "กำลังส่งข้อมูลเข้า Google Apps Script..." -ForegroundColor Cyan
    $postResponse = Invoke-RestMethod -Uri $GAS_URL -Method Post -Body $jsonPayload -ContentType "text/plain; charset=utf-8" -TimeoutSec 20
    
    Write-Host "ผลลัพธ์จาก Apps Script: $($postResponse | ConvertTo-Json -Compress)" -ForegroundColor Green

} catch {
    Write-Host "เกิดข้อผิดพลาด: $($_.Exception.Message)" -ForegroundColor Red
}