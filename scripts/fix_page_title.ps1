# PRINCE ALEX DIGITAL HMS — Fix page-title null errors
# Wraps document.getElementById("page-title").textContent calls in a null check

$jsFiles = @(
    'js/wards.js','js/medicines.js','js/invoices.js','js/lab-results.js',
    'js/prescriptions.js','js/lab-orders.js','js/leave.js','js/laboratory.js',
    'js/notifications-page.js','js/inventory.js','js/pharmacy.js','js/attendance.js',
    'js/suppliers.js','js/payments.js','js/stock-movements.js','js/reports.js',
    'js/billing.js','js/purchase-orders.js','js/staff.js','js/receipts.js',
    'js/audit-logs.js','js/beds.js','js/settings.js'
)

foreach ($fname in $jsFiles) {
    if (-not (Test-Path $fname)) {
        Write-Host "SKIP (not found): $fname"
        continue
    }
    $content = Get-Content $fname -Raw -Encoding UTF8
    $original = $content

    # Replace direct page-title textContent calls with null-safe version
    $content = $content -replace 'document\.getElementById\("page-title"\)\.textContent = "([^"]+)";', 'const pageTitleEl = document.getElementById("page-title"); if (pageTitleEl) pageTitleEl.textContent = "$1";'

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText((Join-Path (Get-Location) $fname), $content, [System.Text.UTF8Encoding]::new($false))
        Write-Host "UPDATED: $fname"
    } else {
        Write-Host "NO CHANGE: $fname"
    }
}