$root = "c:\Users\Alex Senerwa\Desktop\In Progresss\Hospital"

$files = @(
    "js/beds.js", "js/inventory.js", "js/invoices.js", "js/leave.js",
    "js/medicines.js", "js/staff.js", "js/suppliers.js", "js/wards.js",
    "js/payments.js", "js/purchase-orders.js", "js/stock-movements.js",
    "js/attendance.js"
)

# Fix empty-icon divs and button text by adding icon() calls
foreach ($f in $files) {
    $path = Join-Path $root $f
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $changed = $false

    # Fix empty-icon divs - add appropriate icon based on file
    $iconName = switch ($f) {
        "js/beds.js" { "beds" }
        "js/inventory.js" { "inventory" }
        "js/invoices.js" { "invoices" }
        "js/leave.js" { "leave" }
        "js/medicines.js" { "medicines" }
        "js/staff.js" { "patients" }
        "js/suppliers.js" { "suppliers" }
        "js/wards.js" { "wards" }
        "js/payments.js" { "payments" }
        "js/purchase-orders.js" { "lab-orders" }
        "js/stock-movements.js" { "inventory" }
        "js/attendance.js" { "lab-orders" }
        default { "help" }
    }

    # Replace empty-icon divs that have no content
    $content = $content -replace '<div class="empty-icon"></div>', "<div class=`"empty-icon`">`${icon('$iconName', '18', 'icon-svg')}</div>"
    $changed = $true

    # Fix button text - add icon before text
    # Edit buttons
    $content = $content -replace '> Edit</button>', "> `${icon('edit', '18', 'icon-svg')} Edit</button>"
    # Delete buttons
    $content = $content -replace '> Delete</button>', "> `${icon('trash', '18', 'icon-svg')} Delete</button>"
    # Approve buttons
    $content = $content -replace '> Approve</button>', "> `${icon('check', '18', 'icon-svg')} Approve</button>"
    # Reject buttons
    $content = $content -replace '> Reject</button>', "> `${icon('close', '18', 'icon-svg')} Reject</button>"
    # Pay buttons
    $content = $content -replace '> Pay</a>', "> `${icon('payments', '18', 'icon-svg')} Pay</a>"
    # View buttons
    $content = $content -replace '> View</a>', "> `${icon('eye', '18', 'icon-svg')} View</a>"
    # Receipt buttons
    $content = $content -replace '> Receipt</a>', "> `${icon('receipts', '18', 'icon-svg')} Receipt</a>"

    if ($changed) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed: $f"
    }
}

Write-Host "Done!"