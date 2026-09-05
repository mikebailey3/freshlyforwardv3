$dir = "C:\Users\c0b0sty.s02638\Documents\puppy_workspace\freshlyforwardv3\docs\superpowers\visual-review\2026-09-04-hero-redesign"
$htmlPath = Join-Path $dir "report-c4d208f.html"
$outPath = Join-Path $dir "report-c4d208f.bundled.html"

$html = Get-Content -Raw -Path $htmlPath

$images = @(
  "hero-c4d208f-desktop.png",
  "hero-c4d208f-tablet.png",
  "hero-c4d208f-mobile.png"
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
