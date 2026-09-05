$dir = "C:\Users\c0b0sty.s02638\Documents\puppy_workspace\freshlyforwardv3\docs\superpowers\visual-review\2026-09-04-hero-redesign"
$htmlPath = Join-Path $dir "report.html"
$outPath = Join-Path $dir "report.bundled.html"

$html = Get-Content -Raw -Path $htmlPath

$images = @(
  "hero-before-desktop.png",
  "hero-after-desktop.png",
  "hero-after-tablet.png",
  "hero-after-mobile.png",
  "north-star-reference.png"
)

foreach ($img in $images) {
  $imgPath = Join-Path $dir $img
  $bytes = [System.IO.File]::ReadAllBytes($imgPath)
  $b64 = [System.Convert]::ToBase64String($bytes)
  $dataUri = "data:image/png;base64,$b64"
  $html = $html.Replace("src=`"$img`"", "src=`"$dataUri`"")
}

Set-Content -Path $outPath -Value $html -NoNewline
Write-Output "Done. Output size:"
(Get-Item $outPath).Length
