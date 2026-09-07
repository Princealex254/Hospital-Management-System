$root = "c:\Users\Alex Senerwa\Desktop\In Progresss\Hospital"

Write-Host "=== FINAL VERIFICATION ==="
Write-Host ""

# Emoji check (HTML)
Write-Host "--- Emoji check (HTML) ---"
$htmlFiles = Get-ChildItem -Path $root -Filter "*.html" -Recurse
$total = 0
foreach ($f in $htmlFiles) {
    $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $count = 0
    for ($i = 0; $i -lt $content.Length; $i++) {
        $c = [int][char]$content[$i]
        if (($c -ge 0x1F300 -and $c -le 0x1FAFF) -or ($c -ge 0x2600 -and $c -le 0x27BF) -or $c -eq 0xFE0F -or ($c -ge 0x2190 -and $c -le 0x21FF) -or ($c -ge 0x2B00 -and $c -le 0x2BFF)) {
            $count++
        }
    }
    if ($count -gt 0) {
        Write-Host "$($f.Name): $count"
        $total += $count
    }
}
Write-Host "Total: $total"
Write-Host ""

# Emoji check (JS, excl icons.js)
Write-Host "--- Emoji check (JS, excl icons.js) ---"
$jsFiles = Get-ChildItem -Path $root -Filter "*.js" -Recurse | Where-Object { $_.Name -ne "icons.js" }
$total = 0
foreach ($f in $jsFiles) {
    $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $count = 0
    for ($i = 0; $i -lt $content.Length; $i++) {
        $c = [int][char]$content[$i]
        if (($c -ge 0x1F300 -and $c -le 0x1FAFF) -or ($c -ge 0x2600 -and $c -le 0x27BF) -or $c -eq 0xFE0F -or ($c -ge 0x2190 -and $c -le 0x21FF) -or ($c -ge 0x2B00 -and $c -le 0x2BFF)) {
            $count++
        }
    }
    if ($count -gt 0) {
        Write-Host "$($f.Name): $count"
        $total += $count
    }
}
Write-Host "Total: $total"
Write-Host ""

# icon() calls in JS
Write-Host "--- icon() calls in JS ---"
$iconCount = 0
foreach ($f in $jsFiles) {
    $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $iconCount += ([regex]::Matches($content, "icon\('").Count)
}
Write-Host "icon() calls: $iconCount"
Write-Host ""

# Toast counts
Write-Host "--- Toast counts ---"
$successCount = 0
$errorCount = 0
foreach ($f in $jsFiles) {
    $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $successCount += ([regex]::Matches($content, "showToast.*success").Count)
    $errorCount += ([regex]::Matches($content, "showToast.*error").Count)
}
Write-Host "Success toasts: $successCount"
Write-Host "Error toasts: $errorCount"
Write-Host ""

# Login button fix
Write-Host "--- Login button fix ---"
$loginContent = [System.IO.File]::ReadAllText((Join-Path $root "login.html"), [System.Text.Encoding]::UTF8)
if ($loginContent -match "finally") {
    Write-Host "login.html: finally block present"
} else {
    Write-Host "login.html: NO finally block!"
}
Write-Host ""

# SVG sizing
Write-Host "--- SVG sizing ---"
$cssContent = [System.IO.File]::ReadAllText((Join-Path $root "css/style.css"), [System.Text.Encoding]::UTF8)
if ($cssContent -match "svg\[width\]") {
    Write-Host "style.css: SVG sizing OK"
} else {
    Write-Host "style.css: MISSING SVG sizing!"
}
Write-Host ""

Write-Host "=== ALL CHECKS COMPLETE ==="