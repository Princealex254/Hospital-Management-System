$root = "c:\Users\Alex Senerwa\Desktop\In Progresss\Hospital"

# Get all HTML files except login.html and index.html
$htmlFiles = Get-ChildItem -Path $root -Filter "*.html" -Recurse | 
    Where-Object { $_.Name -ne "login.html" -and $_.Name -ne "index.html" }

foreach ($f in $htmlFiles) {
    $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $changed = $false

    # Remove header-container div
    $content = $content -replace '<div id="header-container"></div>\r?\n', ""
    $content = $content -replace '<!-- Header -->\r?\n\s*<div id="header-container"></div>\r?\n', ""
    
    # Remove header.js script tag
    $content = $content -replace '\s*<script type="module" src="js/header\.js"></script>', ""
    
    # Remove with-header class from main-content
    $content = $content -replace 'class="main-content with-header"', 'class="main-content"'
    
    # Remove commented header component reference
    $content = $content -replace '<!-- PRINCE ALEX DIGITAL HMS — Header Component -->\r?\n', ""
    $content = $content -replace '<!-- This file is loaded dynamically by js/header\.js -->\r?\n', ""
    
    if ($content -ne [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)) {
        [System.IO.File]::WriteAllText($f.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Updated: $($f.Name)"
    }
}

Write-Host "Done!"