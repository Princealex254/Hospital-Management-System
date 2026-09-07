$root = "c:\Users\Alex Senerwa\Desktop\In Progresss\Hospital"

# Get all JS files that might import header.js
$jsFiles = Get-ChildItem -Path $root -Filter "*.js" -Recurse | Where-Object { $_.Name -ne "header.js" }

foreach ($f in $jsFiles) {
    $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    
    # Remove import statements for loadHeader
    $content = $content -replace "import \{ loadHeader \} from ""\.\/header\.js"";\r?\n", ""
    $content = $content -replace "import \{ loadHeader \} from '\.\/header\.js';\r?\n", ""
    
    # Remove loadHeader() calls
    $content = $content -replace "await loadHeader\(\);\r?\n", ""
    $content = $content -replace "loadHeader\(\);\r?\n", ""
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($f.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Updated: $($f.Name)"
    }
}

Write-Host "Done!"