# PRINCE ALEX DIGITAL HMS — Restore sidebar container and update JS to use loadNavigation

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

    # Add sidebar container after <div class="app-container">
    $content = $content -replace '<div class="app-container">\s*\r?\n', "<div class=`"app-container`">`r`n        <!-- Sidebar -->`r`n        <div id=`"sidebar-container`"></div>`r`n"

    # Add navigation.js script tag before the page's main JS script
    $content = $content -replace '(<script type="module" src="js/auth-guard\.js"></script>)', "`$1`r`n    <script type=`"module`" src=`"js/navigation.js`"></script>"

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText((Join-Path (Get-Location) $fname), $content, [System.Text.UTF8Encoding]::new($false))
        Write-Host "UPDATED: $fname"
    } else {
        Write-Host "NO CHANGE: $fname"
    }
}

# Update JS files to import and call loadNavigation
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

    # Add import for loadNavigation after requireAuth import
    $content = $content -replace '(import \{ requireAuth \} from "\./auth-guard\.js";)', "`$1`r`nimport { loadNavigation } from `"./navigation.js`";"

    # Add await loadNavigation() after requireAuth check
    $content = $content -replace '(const user = await requireAuth\(\);\r?\n\s*if \(!user\) return;)', "`$1`r`n`r`n        // Load role-based sidebar navigation`r`n        await loadNavigation();"

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText((Join-Path (Get-Location) $fname), $content, [System.Text.UTF8Encoding]::new($false))
        Write-Host "UPDATED: $fname"
    } else {
        Write-Host "NO CHANGE: $fname"
    }
}