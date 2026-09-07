# Fix the sidebar active-page detection in js/navigation.js (folderized URLs)
$root = "c:\Users\Alex Senerwa\Desktop\In Progresss\Hospital"
$p = Join-Path $root "js\navigation.js"
$c = [System.IO.File]::ReadAllText($p)
$old = 'const isActive = window.location.href.includes(item.href);'
if ($c.Contains($old)) {
    $new = 'const currentFolder = window.location.pathname.replace(/\/+$/, "" ).split("/").filter(Boolean .pop() || "" );
            const itemSlug = (item.href || "" ).replace(/^\.\.\//, "" ).replace(/\/+$/, "" ).split(/[?#]/)[0];
            const isActive = itemSlug !== "" && itemSlug === currentFolder;'
    $c = $c.Replace($old, $new)
    [System.IO.File]::WriteAllText($p, $c, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output "nav active check replaced"
} else {
    Write-Output "EXACT NOT FOUND - will try regex"
    $c = [regex]::Replace($c, 'const isActive = window\.location\.href\.includes\(item\.href\);', 'const currentFolder = window.location.pathname.replace(/\/+$/, "" ) .split("/").filter(Boolean .pop() || "" );
            const itemSlug = (item.href || "" ) .replace(/^\.\.\//, "" ) .replace(/\/+$/, "" ) .split(/[?#]/)[0];
            const isActive = itemSlug !== "" && itemSlug === currentFolder;')
    [System.IO.File]::WriteAllText($p, $c, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output "regex path used"
}
Write-Output "DONE"