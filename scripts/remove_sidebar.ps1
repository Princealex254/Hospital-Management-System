# PRINCE ALEX DIGITAL HMS — Remove Sidebar from all HTML pages
# Removes the sidebar container div and sidebar.js script tag

$htmlFiles = @(
    'admin.html','admission-create.html','admissions.html','appointment-create.html',
    'appointments.html','attendance.html','audit-logs.html','beds.html','billing.html',
    'consultation.html','hospitals.html','inventory.html','invoices.html','lab-orders.html',
    'lab-results.html','laboratory.html','leave.html','medicines.html','notifications.html',
    'opd.html','patient-profile.html','patient-register.html','patients.html','payments.html',
    'pharmacy.html','plans.html','prescriptions.html','purchase-orders.html','queue.html',
    'receipts.html','reports.html','settings.html','staff.html','stock-movements.html',
    'subscriptions.html','suppliers.html','vitals.html','wards.html'
)

foreach ($fname in $htmlFiles) {
    if (-not (Test-Path $fname)) {
        Write-Host "SKIP (not found): $fname"
        continue
    }
    $content = Get-Content $fname -Raw -Encoding UTF8
    $original = $content

    # Remove sidebar container div (with optional comment)
    $content = $content -replace '\s*<!-- Sidebar -->\s*<div id="sidebar-container"></div>', ''
    $content = $content -replace '\s*<div id="sidebar-container"></div>', ''

    # Remove sidebar.js script tag
    $content = $content -replace '\s*<script type="module" src="js/sidebar\.js"></script>', ''

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText((Join-Path (Get-Location) $fname), $content, [System.Text.UTF8Encoding]::new($false))
        Write-Host "UPDATED: $fname"
    } else {
        Write-Host "NO CHANGE: $fname"
    }
}