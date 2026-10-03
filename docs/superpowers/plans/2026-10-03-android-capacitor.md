# App Android (Capacitor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Gerar um APK Android nativo (Capacitor 8) do protótipo existente, com GPS nativo, tela sempre ligada, exportação via Compartilhar do Android e APK de release assinado com chave local fora do repositório. A versão web (GitHub Pages) continua funcionando.

**Architecture:** O app React existente vira o `webDir` do Capacitor. Recursos dependentes de plataforma ficam atrás de pequenos módulos que escolhem entre implementação nativa (plugins Capacitor) e web: `src/location/factory.ts`, `src/ui/useWakeLock.ts`, `src/store/exportFile.ts`. Lógica pura (geo, nearest, roads, store) não muda.

**Decisões (aprovadas pelo usuário 2026-10-03):** Capacitor; sem GPS em segundo plano (tela sempre ligada); distribuição por APK direto; manter o site do Pages.

**Tech Stack:** @capacitor/core, @capacitor/cli, @capacitor/android 8.x; @capacitor/geolocation, @capacitor/filesystem, @capacitor/share, @capacitor-community/keep-awake 8.x. JDK 21 em `C:\Program Files\Java\jdk-21`; Android SDK em `%LOCALAPPDATA%\Android\Sdk` (ANDROID_HOME não está definido).

**Ambiente:** Windows; use a ferramenta **PowerShell** para npm/npx/git/gradle. Diretório: `C:\Users\mathe\OneDrive\Área de Trabalho\Semaforo Niteroi`. Branch de trabalho: `feat/android` (criar a partir de `main`). Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca commitar `docs/LAI_*`, `data/raw/`, keystore, senhas ou APKs.

**Constantes:**
- appId: `io.github.matheusmoraesnascimento.semaforoniteroi`
- appName: `Semáforo Niterói`
- Pasta da chave (fora do repo): `C:\Users\mathe\.semaforo-niteroi\` com `release.jks` e `keystore.properties`
- APK final copiado para `release/semaforo-niteroi.apk` (gitignored)

---

### Task 1: Dependências, build por modo e config do Capacitor

**Files:** Modify `package.json`, `vite.config.ts`, `.gitignore`; Create `capacitor.config.ts`

- [ ] **Step 1: Branch e dependências**
```powershell
git switch -c feat/android
npm install @capacitor/core @capacitor/android @capacitor/geolocation @capacitor/filesystem @capacitor/share @capacitor-community/keep-awake
npm install -D @capacitor/cli
```

- [ ] **Step 2: `vite.config.ts` dependente do modo** — base `/` e sem PWA no modo `android`; resto igual ao atual. Estrutura:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const android = mode === 'android';
  return {
    base: android ? '/' : '/semaforo-niteroi/',
    plugins: [
      react(),
      ...(android ? [] : [VitePWA({ /* bloco VitePWA atual, sem mudanças */ })]),
    ],
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
```
Copie o objeto de opções do `VitePWA` atual inteiro (manifest com `lang: 'pt-BR'`, workbox) para dentro.

- [ ] **Step 3: Scripts no `package.json`** (manter os existentes):
```json
"build:android": "tsc --noEmit && vite build --mode android",
"cap:sync": "npm run build:android && cap sync android",
"apk": "npm run cap:sync && powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-apk.ps1"
```

- [ ] **Step 4: `capacitor.config.ts`**
```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.matheusmoraesnascimento.semaforoniteroi',
  appName: 'Semáforo Niterói',
  webDir: 'dist',
  backgroundColor: '#111111',
};

export default config;
```
Edge-to-edge (Android 15+): confira nos tipos de `CapacitorConfig` instalados (`node_modules/@capacitor/cli/dist/declarations.d.ts`) qual opção existe e adicione **uma**: se existir `plugins.SystemBars` com `insetsHandling`, use `plugins: { SystemBars: { insetsHandling: 'css' } }`; senão, se existir `android.adjustMarginsForEdgeToEdge`, use `android: { adjustMarginsForEdgeToEdge: 'force' }`. Objetivo: o painel inferior e a barra superior não ficarem embaixo das barras do sistema. Registre a escolha no relatório.

- [ ] **Step 5: `.gitignore`** — acrescentar:
```
release/
*.jks
*.keystore
keystore.properties
```

- [ ] **Step 6: Verificar** — `npm test` (75 passam), `npm run build` (dist com base `/semaforo-niteroi/` e `sw.js`), `npm run build:android` (dist com `src="/assets/...` e **sem** `sw.js`). Commit `chore(android): Capacitor, build por modo e config`.

---

### Task 2: Plataforma Android (projeto nativo, permissões, orientação, ícones)

**Files:** Create `android/` (gerado), `assets/icon-only.png`; Modify `android/app/src/main/AndroidManifest.xml`, `scripts/make-icons.ps1`

- [ ] **Step 1: Gerar o projeto**
```powershell
npm run build:android
npx cap add android
```
Expected: pasta `android/` criada.

- [ ] **Step 2: `AndroidManifest.xml`** — dentro de `<manifest>` (antes de `<application>` ou junto às permissões existentes):
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" android:required="false" />
```
No `<activity ... android:name=".MainActivity"`, adicionar `android:screenOrientation="portrait"`.

- [ ] **Step 3: Ícone 1024 px** — em `scripts/make-icons.ps1`, trocar `foreach ($size in 192, 512)` por `foreach ($size in 192, 512, 1024)` e, após o loop, copiar o de 1024 para `assets/icon-only.png` (criar a pasta `assets/`) e removê-lo de `public/`:
```powershell
$assets = Join-Path $PSScriptRoot '..\assets'
New-Item -ItemType Directory -Force $assets | Out-Null
Move-Item -Force (Join-Path $out 'icon-1024.png') (Join-Path $assets 'icon-only.png')
```
Rodar o script. Depois:
```powershell
npx @capacitor/assets generate --android --iconBackgroundColor '#111111' --iconBackgroundColorDark '#111111'
```
Se `@capacitor/assets` falhar (dependência nativa `sharp`), pule este passo, mantenha o ícone padrão e registre no relatório.

- [ ] **Step 4: Commit** `feat(android): projeto nativo, permissões de localização, retrato, ícones` (inclui `android/`, `assets/`, script).

---

### Task 3: Conversão de posição compartilhada + GPS nativo + fábrica

**Files:** Create `src/location/positionToFix.ts`, `src/location/capacitorGps.ts`, `src/location/factory.ts`, `src/platform.ts`; Modify `src/location/browserGps.ts`, `src/App.tsx`; Test `src/location/positionToFix.test.ts`, `src/location/factory.test.ts`

- [ ] **Step 1: Testes com falha**

`src/location/positionToFix.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { positionToFix } from './positionToFix';

const pos = (heading: number | null, speed: number | null) => ({
  timestamp: 1000,
  coords: { latitude: -22.9, longitude: -43.1, accuracy: 8, heading, speed },
});

describe('positionToFix', () => {
  it('converte campos', () => {
    expect(positionToFix(pos(90, 10))).toEqual({ lat: -22.9, lon: -43.1, accuracy: 8, heading: 90, speed: 10, timestamp: 1000 });
  });
  it('heading NaN ou null → null', () => {
    expect(positionToFix(pos(Number.NaN, 10)).heading).toBeNull();
    expect(positionToFix(pos(null, 10)).heading).toBeNull();
  });
  it('speed NaN ou undefined → null', () => {
    expect(positionToFix(pos(90, Number.NaN)).speed).toBeNull();
    expect(positionToFix({ timestamp: 1, coords: { latitude: 0, longitude: 0, accuracy: 1 } }).speed).toBeNull();
  });
});
```

`src/location/factory.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createLocationSource } from './factory';
import { SimulatedSource } from './simulated';
import { CapacitorGpsSource } from './capacitorGps';
import { BrowserGpsSource } from './browserGps';

describe('createLocationSource', () => {
  it('simulação tem prioridade', () => {
    expect(createLocationSource({ simulation: true, native: true })).toBeInstanceOf(SimulatedSource);
  });
  it('nativo → Capacitor', () => {
    expect(createLocationSource({ simulation: false, native: true })).toBeInstanceOf(CapacitorGpsSource);
  });
  it('web → navegador', () => {
    expect(createLocationSource({ simulation: false, native: false })).toBeInstanceOf(BrowserGpsSource);
  });
});
```
Run `npx vitest run src/location` → FAIL.

- [ ] **Step 2: `src/location/positionToFix.ts`**
```ts
import type { Fix } from '../types';

export interface PositionLike {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    heading?: number | null;
    speed?: number | null;
  };
}

const finiteOrNull = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function positionToFix(p: PositionLike): Fix {
  return {
    lat: p.coords.latitude,
    lon: p.coords.longitude,
    accuracy: p.coords.accuracy,
    heading: finiteOrNull(p.coords.heading),
    speed: finiteOrNull(p.coords.speed),
    timestamp: p.timestamp,
  };
}
```

- [ ] **Step 3: `browserGps.ts`** — substituir o objeto montado à mão no callback de sucesso por `(p) => onFix(positionToFix(p))` (import de `./positionToFix`). Resto igual.

- [ ] **Step 4: `src/location/capacitorGps.ts`**
```ts
import { Geolocation } from '@capacitor/geolocation';
import type { Fix, LocationSource } from '../types';
import { positionToFix } from './positionToFix';

const DENIED = 'Sem permissão de localização. Libere em Configurações › Apps › Semáforo Niterói › Permissões.';

export class CapacitorGpsSource implements LocationSource {
  private watchId: string | null = null;
  private stopped = false;

  start(onFix: (f: Fix) => void, onError: (msg: string) => void): void {
    this.stopped = false;
    void this.run(onFix, onError);
  }

  private async run(onFix: (f: Fix) => void, onError: (msg: string) => void): Promise<void> {
    try {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') perm = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (perm.location !== 'granted') {
        onError(DENIED);
        return;
      }
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
        (position, err) => {
          if (err || !position) onError('GPS indisponível');
          else onFix(positionToFix(position));
        },
      );
      if (this.stopped) void Geolocation.clearWatch({ id });
      else this.watchId = id;
    } catch {
      onError('GPS indisponível. Verifique se a localização do aparelho está ligada.');
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.watchId !== null) void Geolocation.clearWatch({ id: this.watchId });
    this.watchId = null;
  }
}
```
Se a API instalada diferir (nomes de campos de permissão, assinatura do callback), ajuste ao tipo real do pacote e registre.

- [ ] **Step 5: `src/platform.ts`**
```ts
import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();
```

- [ ] **Step 6: `src/location/factory.ts`**
```ts
import type { LocationSource } from '../types';
import { BrowserGpsSource } from './browserGps';
import { CapacitorGpsSource } from './capacitorGps';
import { SimulatedSource } from './simulated';

export function createLocationSource(opts: { simulation: boolean; native: boolean }): LocationSource {
  if (opts.simulation) return new SimulatedSource();
  return opts.native ? new CapacitorGpsSource() : new BrowserGpsSource();
}
```

- [ ] **Step 7: `App.tsx`** — no efeito da fonte de localização, trocar `const src = simulation ? new SimulatedSource() : new BrowserGpsSource();` por `const src = createLocationSource({ simulation, native: isNative() });` (manter a linha `simSource.current = src instanceof SimulatedSource ? src : null;`). Ajustar imports (remover `BrowserGpsSource` se não usado).

- [ ] **Step 8: Verificar e commit** — `npx vitest run src/location` PASS, `npm test`, `npx tsc --noEmit`. Commit `feat(android): GPS nativo via Capacitor e fábrica de fontes`.

---

### Task 4: Tela ligada nativa e exportação via Compartilhar

**Files:** Modify `src/ui/useWakeLock.ts`, `src/App.tsx`; Create `src/store/exportFile.ts`

- [ ] **Step 1: `useWakeLock.ts`** — no início do efeito, ramo nativo:
```ts
import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNative } from '../platform';
// dentro do useEffect, antes do código web:
if (isNative()) {
  if (!enabled) return;
  void KeepAwake.keepAwake().catch(() => {});
  return () => {
    void KeepAwake.allowSleep().catch(() => {});
  };
}
```
O ramo web existente continua igual.

- [ ] **Step 2: `src/store/exportFile.ts`**
```ts
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { TrafficLight } from '../types';
import { isNative } from '../platform';
import { lightsToGeoJSON } from './geojson';
import { downloadGeoJSON } from './localStore';

const FILENAME = 'traffic_lights.geojson';

/** Web: baixa o arquivo. Android: grava no cache e abre o Compartilhar do sistema. */
export async function exportLights(lights: TrafficLight[]): Promise<void> {
  if (!isNative()) {
    downloadGeoJSON(lights, FILENAME);
    return;
  }
  const { uri } = await Filesystem.writeFile({
    path: FILENAME,
    data: JSON.stringify(lightsToGeoJSON(lights), null, 2),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: 'Semáforos cadastrados', files: [uri] });
}
```

- [ ] **Step 3: `App.tsx`** — `onExport={() => downloadGeoJSON(lights)}` vira:
```tsx
onExport={() => {
  void exportLights(lights).catch((e: unknown) => {
    // cancelar o Compartilhar não é erro para o usuário
    if (!(e instanceof Error && /cancel/i.test(e.message))) setMessage('Erro ao exportar.');
  });
}}
```
Ajustar imports (remover `downloadGeoJSON` do App se não usado).

- [ ] **Step 4: Verificar e commit** — `npm test`, `npx tsc --noEmit`, `npm run build`. Commit `feat(android): tela sempre ligada nativa e exportação via Compartilhar`.

---

### Task 5: Chave de assinatura e build do APK

**Files:** Create `scripts/create-keystore.ps1`, `scripts/build-apk.ps1`; Modify `android/app/build.gradle`

- [ ] **Step 1: `scripts/create-keystore.ps1`** (idempotente; nunca sobrescreve chave existente)
```powershell
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
```
Rodar uma vez: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-keystore.ps1`. Não imprimir a senha.

- [ ] **Step 2: Assinatura no `android/app/build.gradle`** — antes do bloco `android {`:
```groovy
def keystorePropsFile = new File(System.getProperty("user.home"), ".semaforo-niteroi/keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) { keystorePropsFile.withInputStream { keystoreProps.load(it) } }
```
Dentro de `android {`:
```groovy
    signingConfigs {
        release {
            if (keystorePropsFile.exists()) {
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }
```
E no `buildTypes { release { ... } }` existente, adicionar a linha `signingConfig signingConfigs.release`. Se o arquivo gerado for `build.gradle.kts` (Kotlin DSL), traduza equivalente e registre.

- [ ] **Step 3: `scripts/build-apk.ps1`**
```powershell
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
```
Confirme que `android/.gitignore` já ignora `local.properties` (o template do Capacitor ignora); se não, adicione.

- [ ] **Step 4: Gerar o APK** — `npm run apk` (a 1ª execução baixa o Gradle e dependências; pode levar vários minutos; rode com timeout longo ou em background). Expected: `release/semaforo-niteroi.apk` existe.
Se faltar plataforma/build-tools do SDK exigidos pelo Capacitor 8, rode `"$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" "platforms;android-XX" "build-tools;XX.0.0"` com as versões da mensagem de erro (aceitando licenças com `--licenses` se necessário) e registre.

- [ ] **Step 5: Validar assinatura**
```powershell
$bt = Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\build-tools" | Sort-Object Name | Select-Object -Last 1
& (Join-Path $bt.FullName 'apksigner.bat') verify --print-certs release\semaforo-niteroi.apk | Select-String 'Signer #1 certificate DN'
```
Expected: `CN=Semaforo Niteroi, C=BR`.

- [ ] **Step 6: Conferir que nada sensível vai pro git** — `git status --porcelain` não lista `.jks`, `keystore.properties`, `release/`, `local.properties`. Commit `build(android): assinatura com chave local e script do APK` (scripts + build.gradle).

---

### Task 6: Merge e publicação do site

- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` verdes.
- [ ] `git switch main; git merge --ff-only feat/android; git push` (o workflow do Pages publica o site web; ele usa `npm run build`, modo padrão — base `/semaforo-niteroi/`).
- [ ] Acompanhar o run do workflow "Deploy" até sucesso.
