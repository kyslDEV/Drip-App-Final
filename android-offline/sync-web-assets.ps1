$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetRoot = Join-Path $PSScriptRoot 'app\src\main\assets\www'

$files = @(
  'index.html',
  'login.html',
  'DripTeste.html',
  'DripTestF.html',
  'DripSchedule.html',
  'DripReports.html',
  'DripSupervisor.html',
  'DripSettings.html',
  'DripAbsorption.html',
  'drip-data.js',
  'drip-api.js',
  'drip-sync.js',
  'drip-theme.css',
  'drip-ui.js',
  'service-worker.js',
  'manifest.webmanifest',
  'ROADMAP.md'
)

New-Item -ItemType Directory -Force $assetRoot | Out-Null

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $assetRoot -Force
}

$iconTarget = Join-Path $assetRoot 'icons'
if (Test-Path -LiteralPath $iconTarget) {
  Remove-Item -LiteralPath $iconTarget -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'icons') -Destination $iconTarget -Recurse -Force

Write-Host "Assets atualizados em $assetRoot"
