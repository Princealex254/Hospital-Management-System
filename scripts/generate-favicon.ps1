# ─────────────────────────────────────────────────────────────────────────────
#  PRINCE ALEX DIGITAL HMS — Favicon / App Icon generator
#
#  Draws a blue rounded square (#2563eb) with a white medical cross and emits:
#    - favicon.ico            (multi-size PNG-in-ICO: 16, 32, 48, 64, 128, 256)
#    - favicon.png            (256x256 PNG)
#    - apple-touch-icon.png   (180x180 PNG)
#  All written to the repository root so the existing
#  <link rel="icon" href="../favicon.ico"> references resolve.
# ─────────────────────────────────────────────────────────────────────────────
param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

Add-Type -AssemblyName System.Drawing

# Brand colours (matches css/style.css tokens).
$Primary   = [System.Drawing.Color]::FromArgb(38, 99, 235)     # --color-primary #2563eb
$PrimaryDk = [System.Drawing.Color]::FromArgb(29, 78, 216)     # --color-primary-dark #1d4ed8

# Draw one size onto a byte[] PNG.
function New-FaviconPngBytes {
    param([int]$Size)

    $bmp  = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g    = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Rounded-square background with a subtle top-to-bottom gradient.
    $radius = [int]($Size * 0.22)
    $rect   = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $path   = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d      = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect, $Primary, $PrimaryDk, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillPath($grad, $path)
    $grad.Dispose()

    # White medical cross (a plus): vertical + horizontal bars.
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

    $vW = [int]($Size * 0.20)          # vertical bar width
    $vH = [int]($Size * 0.58)          # vertical bar height
    $vX = [int](($Size - $vW) / 2)
    $vY = [int](($Size - $vH) / 2)
    $g.FillRectangle($white, $vX, $vY, $vW, $vH)

    $hW = [int]($Size * 0.58)          # horizontal bar width
    $hH = [int]($Size * 0.20)          # horizontal bar height
    $hX = [int](($Size - $hW) / 2)
    $hY = [int](($Size - $hH) / 2)
    $g.FillRectangle($white, $hX, $hY, $hW, $hH)

    $white.Dispose()
    $g.Dispose()

    $ms    = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = New-Object 'System.Byte[]' $ms.Length
    $ms.Position = 0
    $ms.Read($bytes, 0, $bytes.Length) | Out-Null
    $ms.Dispose()
    $bmp.Dispose()

    # -NoEnumerate stops PowerShell unrolling the array into its elements,
    # so callers receive a genuine byte[] (essential for the ICO writer).
    Write-Output -NoEnumerate $bytes
}

function Save-PngFile {
    param([int]$Size, [string]$OutFile)
    [System.IO.File]::WriteAllBytes($OutFile, (New-FaviconPngBytes $Size))
    Write-Host "  created $OutFile ($Size x $Size)"
}

# Build an ICO (PNG entries) from the given sizes.
function New-IcoBytes {
    param([int[]]$Sizes)

    $pngs    = @{}
    foreach ($s in $Sizes) { $pngs[$s] = [byte[]](New-FaviconPngBytes $s) }

    $count   = $Sizes.Count
    $offset  = 6 + (16 * $count)
    $total   = $offset
    foreach ($s in $Sizes) { $total += $pngs[$s].Length }

    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)

    # ICONDIR
    $bw.Write([uint16]0)          # reserved
    $bw.Write([uint16]1)          # type: icon
    $bw.Write([uint16]$count)     # image count

    $curOffset = $offset
    foreach ($s in $Sizes) {
        $b = [byte[]]$pngs[$s]
        # ICONDIRENTRY
        $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))  # width
        $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))  # height
        $bw.Write([byte]0)          # colour count
        $bw.Write([byte]0)          # reserved
        $bw.Write([uint16]1)        # colour planes
        $bw.Write([uint16]32)       # bits per pixel
        $bw.Write([uint32]$b.Length)
        $bw.Write([uint32]$curOffset)
        $curOffset += $b.Length
    }

    foreach ($s in $Sizes) {
        $bw.Write($pngs[$s])
    }

    $bw.Flush()
    $bytes = $ms.ToArray()
    $bw.Dispose()
    $ms.Dispose()
    return $bytes
}

Write-Host "Generating favicon assets in: $Root"
Save-PngFile 16   (Join-Path $Root "favicon-16.png")
Save-PngFile 32   (Join-Path $Root "favicon-32.png")
Save-PngFile 256  (Join-Path $Root "favicon.png")
Save-PngFile 180  (Join-Path $Root "apple-touch-icon.png")

$icoBytes = New-IcoBytes @(16, 32, 48, 64, 128, 256)
[System.IO.File]::WriteAllBytes((Join-Path $Root "favicon.ico"), $icoBytes)
Write-Host "  created favicon.ico ($($icoBytes.Length) bytes)"

Write-Host "Done."