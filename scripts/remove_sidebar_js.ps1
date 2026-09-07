# PRINCE ALEX DIGITAL HMS — Remove loadSidebar from all JS files
# Removes the loadSidebar import and call from page JS modules

$jsFiles = @(
    'js/admin.js','js/admission-create.js','js/admissions.js','js/appointment-create.js',
    'js/appointments.js','js/attendance.js','js/audit-logs.js','js/beds.js','js/billing.js',
    'js/consultation.js','js/inventory.js','js/invoices.js','js/lab-orders.js',
    'js/lab-results.js','js/laboratory.js','js/leave.js','js/medicines.js',
    'js/notifications-page.js','js/opd.js','js/patient-profile.js','js/patient-register.js',
    'js/patients.js','js/payments.js','js/pharmacy.js','js/prescriptions.js',
    'js/purchase-orders.js','js/queue.js','js/receipts.js','js/reports.js','js/settings.js',
    'js/staff.js','js/stock-movements.js','js/suppliers.js','js/vitals.js','js/wards.js'
)

foreach ($fname in $jsFiles) {
    if (-not (Test-Path $fname)) {
        Write-Host "SKIP (not found): $fname"
        continue
    }
    $content = Get-Content $fname -Raw -Encoding UTF8
    $original = $content

    # Remove import of loadSidebar
    $content = $content -replace 'import \{ loadSidebar \} from "\./sidebar\.js";\r?\n', ''
    $content = $content -replace 'import \{ loadSidebar \} from "\./sidebar\.js";', ''

    # Remove await loadSidebar() call (with optional comment line before)
    $content = $content -replace '\s*// Load shared components\r?\n\s*await loadSidebar\(\);', ''
    $content = $content -replace '\s*await loadSidebar\(\);', ''

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText((Join-Path (Get-Location) $fname), $content, [System.Text.UTF8Encoding]::new($false))
        Write-Host "UPDATED: $fname"
    } else {
        Write-Host "NO CHANGE: $fname"
    }
}