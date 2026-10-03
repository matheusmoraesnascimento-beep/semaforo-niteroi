$dir = Join-Path $env:USERPROFILE '.semaforo-niteroi'
$jks = Join-Path $dir 'release.jks'
$props = Join-Path $dir 'keystore.properties'
if (Test-Path $jks) { Write-Output "Chave já existe em $jks (não alterada)"; exit 0 }
New-Item -ItemType Directory -Force $dir | Out-Null
$bytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$pass = [Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', ''
$keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
& $keytool -genkeypair -keystore $jks -storetype PKCS12 -alias semaforo -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass $pass -keypass $pass -dname 'CN=Semaforo Niteroi, C=BR' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'keytool falhou' }
$jksPath = $jks -replace '\\', '/'
@"
storeFile=$jksPath
storePassword=$pass
keyAlias=semaforo
keyPassword=$pass
"@ | Set-Content -Encoding ascii $props
Write-Output "Chave criada em $jks. FAÇA BACKUP desta pasta: $dir"
