# PRINCE ALEX DIGITAL HMS - Restructure flat *.html pages into name/ folders
# so URLs like /settings/ work. JS/CSS stays at root (js/, css/), and nested page
# files (one level deep) reference them via ../. All page .html links become ../name/.
# index.html (landing) stays at root and links become name/ (flat).

$root = "c:\Users\Alex Senerwa\Desktop\In Progresss\Hospital"
$enc  = New-Object System.Text.UTF8Encoding($false)  # UTF-8 without BOM

function Get-AllText([string]$path) { return [System.IO.File]::ReadAllText($path) }
function Write-AllText([string]$path, [string]$text) { [System.IO.File]::WriteAllText($path, $text, $enc) }

# ── 1. Move every root *.html (except index.html) into "<name>/index.html" and rewrite refs ──
$pageFiles = Get-ChildItem -LiteralPath $root -Filter *.html | Where-Object { $_.Name -ne "index.html" }

foreach ($f in $pageFiles) {
    $name   = $f.BaseName
    $content = Get-AllText $f.FullName

    # Assets -> ../ (since page is now one level deep)
    $content = $content -replace 'href="css/',  'href="../css/'
    $content = $content -replace 'src="js/',   'src="../js/'
    $content = $content -replace 'href="favicon\.ico"', 'href="../favicon.ico"'

    # Bare script refs missing the js/ prefix (e.g. settings.html) -> ../js/X.js
    $content = [regex]::Replace($content, 'src="([a-z0-9-]+)\.js"', 'src="../js/$1.js"')

    # Any page .html reference -> ../name/  (also handles templated ?id= links and inline onclick)
    $content = [regex]::Replace($content, '([a-zA-Z0-9-]+)\.html', '../$1/')

    $dir = Join-Path $root $name
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Move-Item -LiteralPath $f.FullName -Destination (Join-Path $dir "index.html")
    Write-AllText (Join-Path $dir "index.html") $content

    Write-Output ("moved: " + $name)
}

# ── 2. Rewrite refs inside js/*.js (except header.js) ──
$jsFiles = Get-ChildItem -LiteralPath (Join-Path $root "js") -Filter *.js

foreach ($f in $jsFiles) {
    $name    = $f.BaseName
    $content  = Get-AllText $f.FullName
    $original  = $content

    if ($name -eq "header") {
        # component fetch used from one-level-deep pages -> ../components/
        $content = $content -replace 'fetch\("components/header\.html"\)', 'fetch("../components/header.html")'
    } else {
        # Any page .html reference -> ../name/  (handles window.location redirects, template hrefs, sidebar/nav defs)
        $content = [regex]::Replace($content, '([a-zA-Z0-9-]+)\.html', '../$1/')
    }

    if ($content -ne $original) { Write-AllText $f.FullName $content }
}

# ── 3. Rewrite refs inside shared component HTML (injected into depth-1 pages) ──
$compFiles = Get-ChildItem -LiteralPath (Join-Path $root "components") -Filter *.html

foreach ($f in $compFiles) {
    $content  = Get-AllText $f.FullName
    $original  = $content
    $content  = [regex]::Replace($content, '([a-zA-Z0-9-]+)\.html', '../$1/')
    if ($content -ne $original) { Write-AllText $f.FullName $content }
}

# ── 4. index.html (landing) stays at root -> links become name/ (no ../) ──
$idxPath = Join-Path $root "index.html"
$idx    = Get-AllText $idxPath
$idx    = [regex]::Replace($idx, '([a-zA-Z0-9-]+)\.html', '$1/')
Write-AllText $idxPath $idx

Write-Output "DONE"