Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\public'
foreach ($size in 192, 512, 1024) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(17, 17, 17))
  $w = [int]($size * 0.36); $x = [int](($size - $w) / 2)
  $r = [int]($w * 0.7); $cx = [int](($size - $r) / 2)
  $body = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(51, 51, 51))
  $g.FillRectangle($body, $x, [int]($size * 0.1), $w, [int]($size * 0.8))
  $colors = @(
    [System.Drawing.Color]::FromArgb(229, 57, 53),
    [System.Drawing.Color]::FromArgb(255, 193, 7),
    [System.Drawing.Color]::FromArgb(67, 160, 71)
  )
  for ($i = 0; $i -lt 3; $i++) {
    $b = New-Object System.Drawing.SolidBrush $colors[$i]
    $g.FillEllipse($b, $cx, [int]($size * 0.13 + $i * $size * 0.255), $r, $r)
  }
  $bmp.Save((Join-Path $out "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

$assets = Join-Path $PSScriptRoot '..\assets'
New-Item -ItemType Directory -Force $assets | Out-Null
Move-Item -Force (Join-Path $out 'icon-1024.png') (Join-Path $assets 'icon-only.png')
