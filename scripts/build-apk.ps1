$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$sdk = $env:ANDROID_HOME -replace '\\', '/'
Set-Content -Encoding ascii (Join-Path $root 'android\local.properties') "sdk.dir=$sdk"
if (-not (Test-Path (Join-Path $env:USERPROFILE '.semaforo-niteroi\keystore.properties'))) {
  throw 'Chave não encontrada. Rode scripts/create-keystore.ps1 primeiro.'
}
Push-Location (Join-Path $root 'android')
try {
  & .\gradlew.bat assembleRelease --console=plain -q
  if ($LASTEXITCODE -ne 0) { throw 'gradle falhou' }
} finally { Pop-Location }
$apk = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk'
$outDir = Join-Path $root 'release'
New-Item -ItemType Directory -Force $outDir | Out-Null
Copy-Item -Force $apk (Join-Path $outDir 'semaforo-niteroi.apk')
Write-Output "APK: $(Join-Path $outDir 'semaforo-niteroi.apk')"
