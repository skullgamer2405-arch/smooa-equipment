# ============================================================
#  SMO Equipment — Git Sync Script
#  รัน script นี้เพื่อ commit และ push การเปลี่ยนแปลงทั้งหมด
#  ขึ้น GitHub โดยอัตโนมัติ
# ============================================================

param(
    [string]$Message = ""
)

# ─── Colors ────────────────────────────────────────────────
function Write-Header  { param($t) Write-Host "`n$t" -ForegroundColor Cyan }
function Write-Success { param($t) Write-Host "  ✅ $t" -ForegroundColor Green }
function Write-Warning { param($t) Write-Host "  ⚠️  $t" -ForegroundColor Yellow }
function Write-Error   { param($t) Write-Host "  ❌ $t" -ForegroundColor Red }
function Write-Info    { param($t) Write-Host "  📋 $t" -ForegroundColor White }

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║    SMO Equipment — GitHub Sync Tool              ║" -ForegroundColor Blue
Write-Host "║    ระบบยืม-คืนอุปกรณ์ สโมสรนักศึกษา             ║" -ForegroundColor Blue
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Blue

# ─── Find Git ──────────────────────────────────────────────
Write-Header "🔍 ตรวจสอบ Git..."
$gitPaths = @(
    "C:\Users\SCI\AppData\Local\Programs\Git\cmd\git.exe",
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe"
)
$gitExe = $gitPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $gitExe) {
    # fallback: ลองจาก PATH
    try { $gitExe = (Get-Command git -ErrorAction Stop).Source } catch {}
}

if (-not $gitExe) {
    Write-Error "ไม่พบ Git — กรุณาติดตั้ง Git ก่อน: https://git-scm.com/download/win"
    exit 1
}
Write-Success "พบ Git: $gitExe"
function Invoke-Git { & $gitExe @args }

# ─── Check Git Status ──────────────────────────────────────
Write-Header "📂 สถานะไฟล์ที่เปลี่ยนแปลง..."
$status = Invoke-Git status --porcelain 2>&1

if (-not $status) {
    Write-Warning "ไม่มีการเปลี่ยนแปลงใดๆ ที่ต้อง sync"
    Write-Host ""
    exit 0
}

# แสดงไฟล์ที่เปลี่ยนแปลง
$statusLines = $status -split "`n" | Where-Object { $_ -match '\S' }
foreach ($line in $statusLines) {
    Write-Info $line.Trim()
}
Write-Host ""
Write-Info "พบการเปลี่ยนแปลง $($statusLines.Count) รายการ"

# ─── Commit Message ────────────────────────────────────────
Write-Header "💬 ข้อความ Commit..."
if (-not $Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $defaultMsg = "chore: sync changes [$timestamp]"
    Write-Host "  กรอก commit message (กด Enter เพื่อใช้ค่า default):" -ForegroundColor White
    Write-Host "  Default: $defaultMsg" -ForegroundColor DarkGray
    $inputMsg = Read-Host "  > "
    if ($inputMsg.Trim()) {
        $Message = $inputMsg.Trim()
    } else {
        $Message = $defaultMsg
    }
}
Write-Info "Commit message: `"$Message`""

# ─── Git Add ───────────────────────────────────────────────
Write-Header "➕ เพิ่มไฟล์ทั้งหมด (git add -A)..."
Invoke-Git add -A 2>&1 | ForEach-Object { Write-Info $_ }
Write-Success "เพิ่มไฟล์เรียบร้อย"

# ─── Git Commit ────────────────────────────────────────────
Write-Header "📝 Commit การเปลี่ยนแปลง..."
$commitOutput = Invoke-Git commit -m $Message 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Commit เรียบร้อย"
    $commitOutput | ForEach-Object { Write-Info $_ }
} else {
    Write-Error "Commit ล้มเหลว:"
    $commitOutput | ForEach-Object { Write-Error $_ }
    exit 1
}

# ─── Git Push ──────────────────────────────────────────────
Write-Header "🚀 Push ขึ้น GitHub..."
$pushOutput = Invoke-Git push origin master:main 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Push เรียบร้อยแล้ว! 🎉"
    $pushOutput | ForEach-Object { Write-Info $_ }
} else {
    # ลอง pull --rebase แล้ว push ใหม่
    Write-Warning "Push ล้มเหลว — กำลังลอง pull แล้ว push ใหม่..."
    Invoke-Git pull origin main --rebase 2>&1 | ForEach-Object { Write-Info $_ }
    $pushOutput2 = Invoke-Git push origin master:main 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Push เรียบร้อยแล้ว! 🎉"
    } else {
        Write-Error "Push ล้มเหลว — ตรวจสอบ permission หรือ conflict:"
        $pushOutput2 | ForEach-Object { Write-Error $_ }
        exit 1
    }
}

# ─── Done ──────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Sync สำเร็จ! GitHub Actions กำลัง deploy...  ║" -ForegroundColor Green
Write-Host "║  🔗 https://github.com/skullgamer2405-arch/      ║" -ForegroundColor Green
Write-Host "║     smooa-equipment/actions                      ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
