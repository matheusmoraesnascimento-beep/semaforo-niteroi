# Protótipo Mapa + GPS + Próximo Semáforo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA em React que mostra a posição GPS num mapa, os semáforos cadastrados à mão, a distância até o próximo semáforo no sentido de deslocamento, a mão da rua atual e um alerta visual de possível contramão.

**Architecture:** Lógica pura em TypeScript (`src/geo`, `src/nearest`, `src/roads`, `src/store`), testada com Vitest e sem dependência de React ou do navegador. A UI em React usa o MapLibre GL diretamente (imperativo, dentro de um componente), não o `react-map-gl`. A localização fica atrás da interface `LocationSource` (GPS real ou simulação), para trocar por Capacitor depois.

**Tech Stack:** Vite, React 19, TypeScript 5.9, maplibre-gl, vite-plugin-pwa, Vitest. Mapa: OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty`, source vetorial `openmaptiles`). Deploy: GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-03-prototipo-mapa-gps-design.md`

**Ambiente:** Windows; use a ferramenta **PowerShell** para `npm` e `git` (o Bash daqui não tem git/node no PATH). Diretório de trabalho: `C:\Users\mathe\OneDrive\Área de Trabalho\Semaforo Niteroi`. Mensagens de commit terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (no PowerShell use `` `n `` para quebra de linha dentro de `-m "..."`).

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | Build, testes, PWA |
| `src/types.ts` | Tipos compartilhados (Fix, TrafficLight, NextResult, RoadSegment, LocalState, interfaces de fonte) |
| `src/geo/geo.ts` | Distância, bearing, diferença angular, destino, círculo, ponto↔segmento |
| `src/nearest/heading.ts` | `HeadingTracker`: heading efetivo a partir dos fixes |
| `src/nearest/nearest.ts` | `findNextTrafficLight` |
| `src/roads/match.ts` | `matchRoad`, `allowedBearing`, `nearestName` |
| `src/roads/wrongWay.ts` | `WrongWayDetector` |
| `src/roads/tileRoads.ts` | `featuresToSegments`, `filterNear`, `createTileRoadSource(map)` |
| `src/store/geojson.ts` | GeoJSON ↔ TrafficLight, validação, merge |
| `src/store/localState.ts` | `upsertLight`, `removeLight` (puro) |
| `src/store/localStore.ts` | localStorage, fetch da base, download do arquivo |
| `src/location/simulated.ts` | `makeSimFix`, `SimulatedSource` |
| `src/location/browserGps.ts` | `BrowserGpsSource` (watchPosition) |
| `src/ui/format.ts` | `formatDistance` |
| `src/ui/MapView.tsx` | Mapa MapLibre, camadas, follow/rotação, cliques |
| `src/ui/DriverPanel.tsx` | Painel inferior do motorista |
| `src/ui/StreetBanner.tsx` | Barra superior: nome da rua e mão |
| `src/ui/WrongWayAlert.tsx` | Faixa vermelha de contramão |
| `src/ui/EditPanel.tsx` | Modo cadastro |
| `src/ui/useWakeLock.ts` | Mantém a tela ligada |
| `src/App.tsx`, `src/main.tsx`, `src/index.css` | Composição e estilos |
| `public/data/traffic_lights.geojson` | Base versionada de semáforos |
| `public/icon-192.png`, `public/icon-512.png`, `scripts/make-icons.ps1` | Ícones do PWA |
| `.github/workflows/deploy.yml` | CI + deploy no Pages |

---

### Task 0: Ajustar a spec às decisões do plano

**Files:**
- Modify: `docs/superpowers/specs/2026-10-03-prototipo-mapa-gps-design.md`

- [ ] **Step 1: Trocar a linha do Mapa na tabela Stack**

Substituir:
```
| Mapa | MapLibre GL JS via `react-map-gl` (entrada `react-map-gl/maplibre`) |
```
por:
```
| Mapa | MapLibre GL JS usado diretamente num componente React (sem `react-map-gl`, evita incompatibilidade de versões) |
```

- [ ] **Step 2: Trocar o cadastro por arraste pelo cadastro com dois toques**

Substituir:
```
- Toque no mapa → define posição; arrastar a partir dela → define `approachBearing` (seta de pré-visualização); campo opcional de nome; Salvar/Cancelar.
```
por:
```
- 1º toque no mapa → posição do semáforo; 2º toque → um ponto depois do semáforo, na direção em que seguem os carros que ele controla; `approachBearing` = bearing do 1º para o 2º ponto (linha de pré-visualização). Campo opcional de nome; Salvar/Cancelar. Um 3º toque recomeça. (Arrastar move o mapa no celular, por isso dois toques.)
```

- [ ] **Step 3: Commit**

```powershell
git add docs/superpowers/specs/2026-10-03-prototipo-mapa-gps-design.md
git commit -m "docs(spec): MapLibre direto e cadastro por dois toques`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/smoke.test.ts`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "semaforo-niteroi",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Instalar dependências**

```powershell
npm install react react-dom maplibre-gl
npm install -D typescript@~5.9.0 vite @vitejs/plugin-react vite-plugin-pwa vitest @types/react @types/react-dom @types/geojson
```
Esperado: termina sem `ERR!`. Se `vite-plugin-pwa` reclamar de peer `vite`, rode `npm view vite-plugin-pwa peerDependencies` e instale a maior versão de `vite` aceita.

- [ ] **Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Criar `vite.config.ts`** (o PWA entra na Task 13)

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/semaforo-niteroi/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Criar `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#111111" />
    <link rel="icon" type="image/png" href="/icon-192.png" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <title>Semáforo Niterói</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Criar `src/main.tsx`, `src/App.tsx` (provisório), `src/index.css` (vazio por enquanto)**

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <div>Semáforo Niterói</div>;
}
```

`src/index.css`:
```css
html, body, #root { margin: 0; height: 100%; }
```

- [ ] **Step 7: Teste de fumaça**

`src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest roda', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Verificar testes e build**

Run: `npm test`
Expected: `1 passed`.
Run: `npm run build`
Expected: termina sem erros e cria `dist/index.html`.

- [ ] **Step 9: Commit**

```powershell
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src
git commit -m "chore: scaffold Vite + React + TS + Vitest`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tipos compartilhados + módulo geo

**Files:**
- Create: `src/types.ts`, `src/geo/geo.ts`
- Test: `src/geo/geo.test.ts`
- Delete: `src/smoke.test.ts`

- [ ] **Step 1: Criar `src/types.ts`**

```ts
export interface LatLon {
  lat: number;
  lon: number;
}

export interface Fix extends LatLon {
  accuracy: number; // metros
  speed: number | null; // m/s
  heading: number | null; // graus 0–360, null se desconhecido
  timestamp: number; // ms
}

export interface TrafficLight {
  id: string;
  lat: number;
  lon: number;
  approachBearing: number; // direção de deslocamento dos veículos controlados, 0–360
  name?: string;
  createdAt: string;
  source: 'manual';
}

export type NextResult =
  | { kind: 'found'; light: TrafficLight; distance: number }
  | { kind: 'none' }
  | { kind: 'no-heading' };

export interface RoadSegment {
  id: string;
  name: string | null;
  oneway: 0 | 1 | -1; // 1 = sentido da geometria; -1 = contrário; 0 = mão dupla
  coords: [number, number][]; // [lon, lat]
}

export interface RoadSource {
  segmentsNear(lat: number, lon: number, radiusM: number): RoadSegment[];
  namedSegmentsNear(lat: number, lon: number, radiusM: number): RoadSegment[];
}

export interface LocationSource {
  start(onFix: (f: Fix) => void, onError: (msg: string) => void): void;
  stop(): void;
}

export interface LocalState {
  lights: TrafficLight[];
  deleted: string[];
}
```

- [ ] **Step 2: Escrever o teste com falha `src/geo/geo.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  angleDiff, bearingDeg, circlePolygon, destination, distanceM, normalizeBearing, pointToSegment,
} from './geo';

const O = { lat: -22.9, lon: -43.1 };

describe('distanceM', () => {
  it('1 grau de latitude ≈ 111.195 m', () => {
    expect(distanceM(O, { lat: -21.9, lon: -43.1 })).toBeCloseTo(111195, -2);
  });
  it('mesmo ponto = 0', () => {
    expect(distanceM(O, O)).toBe(0);
  });
});

describe('bearingDeg', () => {
  it('norte = 0', () => expect(bearingDeg(O, { lat: -22.8, lon: -43.1 })).toBeCloseTo(0, 6));
  it('sul = 180', () => expect(bearingDeg(O, { lat: -23.0, lon: -43.1 })).toBeCloseTo(180, 6));
  it('leste ≈ 90', () => expect(Math.abs(bearingDeg(O, { lat: -22.9, lon: -43.0 }) - 90)).toBeLessThan(0.1));
  it('oeste ≈ 270', () => expect(Math.abs(bearingDeg(O, { lat: -22.9, lon: -43.2 }) - 270)).toBeLessThan(0.1));
});

describe('normalizeBearing / angleDiff', () => {
  it('normaliza negativos e > 360', () => {
    expect(normalizeBearing(-90)).toBe(270);
    expect(normalizeBearing(370)).toBe(10);
  });
  it('diferença com wrap', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(0, 180)).toBe(180);
    expect(angleDiff(-90, 270)).toBe(0);
  });
});

describe('destination', () => {
  it('ida e volta: 100 m a 45°', () => {
    const p = destination(O, 45, 100);
    expect(distanceM(O, p)).toBeCloseTo(100, 2);
    expect(bearingDeg(O, p)).toBeCloseTo(45, 2);
  });
});

describe('pointToSegment', () => {
  const A = destination(O, 180, 50);
  const B = destination(O, 0, 50);
  const a: [number, number] = [A.lon, A.lat];
  const b: [number, number] = [B.lon, B.lat];

  it('ponto 10 m ao lado do meio do segmento', () => {
    const r = pointToSegment(destination(O, 90, 10), a, b);
    expect(Math.abs(r.distance - 10)).toBeLessThan(0.1);
    expect(angleDiff(r.bearing, 0)).toBeLessThan(0.1);
  });
  it('ponto além da ponta mede até a ponta', () => {
    const r = pointToSegment(destination(B, 0, 20), a, b);
    expect(Math.abs(r.distance - 20)).toBeLessThan(0.1);
  });
});

describe('circlePolygon', () => {
  it('anel fechado com raio correto', () => {
    const ring = circlePolygon(O, 30, 16);
    expect(ring).toHaveLength(17);
    expect(ring[16]).toEqual(ring[0]);
    for (const [lon, lat] of ring) {
      expect(Math.abs(distanceM(O, { lat, lon }) - 30)).toBeLessThan(0.01);
    }
  });
});
```

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `npx vitest run src/geo`
Expected: FAIL (`Failed to resolve import "./geo"` ou equivalente).

- [ ] **Step 4: Implementar `src/geo/geo.ts`**

```ts
import type { LatLon } from '../types';

export const EARTH_RADIUS_M = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function normalizeBearing(b: number): number {
  return ((b % 360) + 360) % 360;
}

export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: LatLon, b: LatLon): number {
  const p1 = toRad(a.lat);
  const p2 = toRad(b.lat);
  const dl = toRad(b.lon - a.lon);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return normalizeBearing(toDeg(Math.atan2(y, x)));
}

/** Menor diferença entre dois ângulos, 0–180. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(normalizeBearing(a) - normalizeBearing(b));
  return d > 180 ? 360 - d : d;
}

export function destination(from: LatLon, bearing: number, distM: number): LatLon {
  const d = distM / EARTH_RADIUS_M;
  const t = toRad(bearing);
  const p1 = toRad(from.lat);
  const l1 = toRad(from.lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: toDeg(p2), lon: toDeg(l2) };
}

/** Anel fechado [lon, lat] aproximando um círculo. */
export function circlePolygon(center: LatLon, radiusM: number, steps = 32): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const p = destination(center, (i * 360) / steps, radiusM);
    ring.push([p.lon, p.lat]);
  }
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

/**
 * Distância (m) do ponto p ao segmento a→b ([lon, lat]) e bearing do segmento a→b.
 * Projeção equirretangular local — precisa para distâncias de dezenas/centenas de metros.
 */
export function pointToSegment(
  p: LatLon,
  a: [number, number],
  b: [number, number],
): { distance: number; bearing: number } {
  const cosLat = Math.cos(toRad(p.lat));
  const proj = (c: [number, number]) => ({
    x: toRad(c[0] - p.lon) * cosLat * EARTH_RADIUS_M,
    y: toRad(c[1] - p.lat) * EARTH_RADIUS_M,
  });
  const A = proj(a);
  const B = proj(b);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : -(A.x * dx + A.y * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const distance = Math.hypot(A.x + t * dx, A.y + t * dy);
  const bearing = bearingDeg({ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] });
  return { distance, bearing };
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/geo`
Expected: PASS, todos os testes de `geo.test.ts`.

- [ ] **Step 6: Remover o teste de fumaça e fazer commit**

```powershell
git rm -q src/smoke.test.ts
git add src/types.ts src/geo
git commit -m "feat(geo): distância, bearing, ângulos e ponto-segmento`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: HeadingTracker (heading efetivo)

**Files:**
- Create: `src/nearest/heading.ts`
- Test: `src/nearest/heading.test.ts`

- [ ] **Step 1: Escrever o teste com falha**

```ts
import { describe, it, expect } from 'vitest';
import { HeadingTracker } from './heading';
import { destination } from '../geo/geo';
import type { Fix, LatLon } from '../types';

const O = { lat: -22.9, lon: -43.1 };
const fix = (p: LatLon, heading: number | null, speed: number | null): Fix => ({
  lat: p.lat, lon: p.lon, accuracy: 5, heading, speed, timestamp: 0,
});

describe('HeadingTracker', () => {
  it('usa o heading do GPS quando a velocidade ≥ 1,5 m/s', () => {
    const t = new HeadingTracker();
    expect(t.update(fix(O, 123, 5))).toBe(123);
  });

  it('ignora o heading do GPS em velocidade baixa', () => {
    const t = new HeadingTracker();
    expect(t.update(fix(O, 123, 0.5))).toBeNull();
  });

  it('calcula pelo deslocamento ≥ 10 m quando não há heading do GPS', () => {
    const t = new HeadingTracker();
    t.update(fix(O, null, null));
    const P = destination(O, 90, 15);
    expect(Math.abs(t.update(fix(P, null, null))! - 90)).toBeLessThan(0.5);
  });

  it('mantém o último heading em deslocamento pequeno', () => {
    const t = new HeadingTracker();
    t.update(fix(O, null, null));
    const P = destination(O, 90, 15);
    t.update(fix(P, null, null));
    const Q = destination(P, 0, 3);
    expect(Math.abs(t.update(fix(Q, null, null))! - 90)).toBeLessThan(0.5);
  });

  it('parado mantém o último heading do GPS', () => {
    const t = new HeadingTracker();
    t.update(fix(O, 45, 5));
    expect(t.update(fix(O, null, 0))).toBe(45);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/nearest/heading`
Expected: FAIL (módulo `./heading` inexistente).

- [ ] **Step 3: Implementar `src/nearest/heading.ts`**

```ts
import type { Fix, LatLon } from '../types';
import { bearingDeg, distanceM, normalizeBearing } from '../geo/geo';

export const HEADING_DEFAULTS = { minSpeed: 1.5, minMove: 10 };

export class HeadingTracker {
  private anchor: LatLon | null = null;
  private current: number | null = null;
  private readonly opts: typeof HEADING_DEFAULTS;

  constructor(opts: typeof HEADING_DEFAULTS = HEADING_DEFAULTS) {
    this.opts = opts;
  }

  update(fix: Fix): number | null {
    const pos = { lat: fix.lat, lon: fix.lon };
    if (
      fix.heading !== null &&
      Number.isFinite(fix.heading) &&
      fix.speed !== null &&
      fix.speed >= this.opts.minSpeed
    ) {
      this.current = normalizeBearing(fix.heading);
      this.anchor = pos;
      return this.current;
    }
    if (this.anchor === null) {
      this.anchor = pos;
      return this.current;
    }
    if (distanceM(this.anchor, pos) >= this.opts.minMove) {
      this.current = bearingDeg(this.anchor, pos);
      this.anchor = pos;
    }
    return this.current;
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/nearest/heading`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```powershell
git add src/nearest
git commit -m "feat(nearest): HeadingTracker com fallback por deslocamento`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: findNextTrafficLight

**Files:**
- Create: `src/nearest/nearest.ts`
- Test: `src/nearest/nearest.test.ts`

- [ ] **Step 1: Escrever o teste com falha**

```ts
import { describe, it, expect } from 'vitest';
import { findNextTrafficLight } from './nearest';
import { destination } from '../geo/geo';
import type { TrafficLight } from '../types';

const O = { lat: -22.9, lon: -43.1 };
function light(id: string, bearingFromO: number, dist: number, approach: number): TrafficLight {
  const p = destination(O, bearingFromO, dist);
  return { id, lat: p.lat, lon: p.lon, approachBearing: approach, createdAt: '2026-10-03T00:00:00Z', source: 'manual' };
}

describe('findNextTrafficLight', () => {
  it('sem heading → no-heading', () => {
    expect(findNextTrafficLight(O, null, [light('a', 0, 100, 0)]).kind).toBe('no-heading');
  });

  it('à frente e no meu sentido → found', () => {
    const r = findNextTrafficLight(O, 0, [light('a', 0, 100, 0)]);
    expect(r.kind).toBe('found');
    if (r.kind === 'found') {
      expect(r.light.id).toBe('a');
      expect(Math.abs(r.distance - 100)).toBeLessThan(0.5);
    }
  });

  it('à frente mas controla o sentido oposto → none', () => {
    expect(findNextTrafficLight(O, 0, [light('a', 0, 100, 180)]).kind).toBe('none');
  });

  it('atrás → none', () => {
    expect(findNextTrafficLight(O, 0, [light('a', 180, 100, 0)]).kind).toBe('none');
  });

  it('transversal (controla 90°) → none', () => {
    expect(findNextTrafficLight(O, 0, [light('a', 0, 100, 90)]).kind).toBe('none');
  });

  it('ao lado (bearing 90°) → none', () => {
    expect(findNextTrafficLight(O, 0, [light('a', 90, 100, 0)]).kind).toBe('none');
  });

  it('além de 500 m → none', () => {
    expect(findNextTrafficLight(O, 0, [light('a', 0, 600, 0)]).kind).toBe('none');
  });

  it('dois candidatos → o mais perto', () => {
    const r = findNextTrafficLight(O, 0, [light('far', 0, 200, 0), light('near', 0, 100, 0)]);
    expect(r.kind === 'found' && r.light.id).toBe('near');
  });

  it('histerese: mantém o anterior se o novo não for ≥ 20 m mais perto', () => {
    const lights = [light('prev', 0, 110, 0), light('new', 5, 100, 0)];
    const r = findNextTrafficLight(O, 0, lights, 'prev');
    expect(r.kind === 'found' && r.light.id).toBe('prev');
  });

  it('histerese: troca se o novo for ≥ 20 m mais perto', () => {
    const lights = [light('prev', 0, 110, 0), light('new', 5, 85, 0)];
    const r = findNextTrafficLight(O, 0, lights, 'prev');
    expect(r.kind === 'found' && r.light.id).toBe('new');
  });

  it('a menos de 25 m ignora a regra de estar à frente', () => {
    const r = findNextTrafficLight(O, 0, [light('a', 90, 10, 0)]);
    expect(r.kind === 'found' && r.light.id).toBe('a');
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/nearest/nearest`
Expected: FAIL (módulo `./nearest` inexistente).

- [ ] **Step 3: Implementar `src/nearest/nearest.ts`**

```ts
import type { LatLon, NextResult, TrafficLight } from '../types';
import { angleDiff, bearingDeg, distanceM } from '../geo/geo';

export const NEAREST_DEFAULTS = {
  maxDistance: 500,
  aheadTolerance: 35,
  approachTolerance: 45,
  closeRange: 25,
  hysteresis: 20,
};

export function findNextTrafficLight(
  pos: LatLon,
  heading: number | null,
  lights: TrafficLight[],
  prevId: string | null = null,
  opts = NEAREST_DEFAULTS,
): NextResult {
  if (heading === null) return { kind: 'no-heading' };

  const candidates = lights
    .map((light) => ({ light, distance: distanceM(pos, light) }))
    .filter(({ light, distance }) => {
      if (distance > opts.maxDistance) return false;
      if (angleDiff(heading, light.approachBearing) > opts.approachTolerance) return false;
      if (distance < opts.closeRange) return true;
      return angleDiff(heading, bearingDeg(pos, light)) <= opts.aheadTolerance;
    })
    .sort((a, b) => a.distance - b.distance);

  if (candidates.length === 0) return { kind: 'none' };

  const best = candidates[0];
  const prev = prevId === null ? undefined : candidates.find((c) => c.light.id === prevId);
  if (prev && prev !== best && best.distance > prev.distance - opts.hysteresis) {
    return { kind: 'found', light: prev.light, distance: prev.distance };
  }
  return { kind: 'found', light: best.light, distance: best.distance };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/nearest`
Expected: PASS (testes de heading + nearest).

- [ ] **Step 5: Commit**

```powershell
git add src/nearest
git commit -m "feat(nearest): próximo semáforo por ângulo, distância e histerese`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Store — GeoJSON, merge e estado local

**Files:**
- Create: `src/store/geojson.ts`, `src/store/localState.ts`, `src/store/localStore.ts`, `public/data/traffic_lights.geojson`
- Test: `src/store/geojson.test.ts`, `src/store/localState.test.ts`

- [ ] **Step 1: Escrever os testes com falha**

`src/store/geojson.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { lightsToGeoJSON, mergeLights, parseLightsGeoJSON } from './geojson';
import type { TrafficLight } from '../types';

const L = (id: string, extra: Partial<TrafficLight> = {}): TrafficLight => ({
  id, lat: -22.9, lon: -43.1, approachBearing: 90, createdAt: '2026-10-03T00:00:00Z', source: 'manual', ...extra,
});

describe('GeoJSON ida e volta', () => {
  it('preserva os campos', () => {
    const lights = [L('a', { name: 'Av. X × R. Y' }), L('b')];
    expect(parseLightsGeoJSON(lightsToGeoJSON(lights))).toEqual({ lights, rejected: 0 });
  });
  it('usa [lon, lat] nas coordenadas', () => {
    expect(lightsToGeoJSON([L('a')]).features[0].geometry.coordinates).toEqual([-43.1, -22.9]);
  });
});

describe('parseLightsGeoJSON', () => {
  it('lança erro se não for FeatureCollection', () => {
    expect(() => parseLightsGeoJSON({ type: 'Feature' })).toThrow('FeatureCollection');
  });

  it('rejeita features inválidas e conta', () => {
    const data = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-43.1, -22.9] }, properties: { id: 'ok', approachBearing: 10 } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { id: 'x', approachBearing: 10 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-43.1, -22.9] }, properties: { approachBearing: 10 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-43.1, -22.9] }, properties: { id: 'y', approachBearing: 400 } },
      ],
    };
    const r = parseLightsGeoJSON(data, () => 'NOW');
    expect(r.rejected).toBe(3);
    expect(r.lights).toEqual([
      { id: 'ok', lat: -22.9, lon: -43.1, approachBearing: 10, createdAt: 'NOW', source: 'manual' },
    ]);
  });

  it('remove espaços do nome e ignora nome vazio', () => {
    const data = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-43.1, -22.9] }, properties: { id: 'a', approachBearing: 0, name: '  Rua A  ', createdAt: 'T' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-43.1, -22.9] }, properties: { id: 'b', approachBearing: 360, name: '   ', createdAt: 'T' } },
      ],
    };
    const r = parseLightsGeoJSON(data);
    expect(r.lights[0].name).toBe('Rua A');
    expect(r.lights[1].name).toBeUndefined();
    expect(r.lights[1].approachBearing).toBe(0);
  });
});

describe('mergeLights', () => {
  it('o local vence a base no mesmo id', () => {
    const r = mergeLights([L('a', { name: 'base' }), L('b')], [L('a', { name: 'local' }), L('c')]);
    expect(r.map((l) => [l.id, l.name])).toEqual([['a', 'local'], ['b', undefined], ['c', undefined]]);
  });
  it('remove os ids excluídos', () => {
    expect(mergeLights([L('a'), L('b')], [], ['a']).map((l) => l.id)).toEqual(['b']);
  });
});
```

`src/store/localState.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { removeLight, upsertLight } from './localState';
import type { TrafficLight } from '../types';

const L = (id: string, name?: string): TrafficLight => ({
  id, lat: 0, lon: 0, approachBearing: 0, createdAt: 'T', source: 'manual', ...(name ? { name } : {}),
});

describe('localState', () => {
  it('upsert adiciona e substitui pelo id', () => {
    let s = upsertLight({ lights: [], deleted: [] }, L('a', 'v1'));
    s = upsertLight(s, L('a', 'v2'));
    expect(s.lights).toEqual([L('a', 'v2')]);
  });
  it('upsert tira o id da lista de excluídos', () => {
    expect(upsertLight({ lights: [], deleted: ['a'] }, L('a')).deleted).toEqual([]);
  });
  it('remove tira dos locais e marca como excluído, sem duplicar', () => {
    let s = removeLight({ lights: [L('a'), L('b')], deleted: [] }, 'a');
    s = removeLight(s, 'a');
    expect(s).toEqual({ lights: [L('b')], deleted: ['a'] });
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/store`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar `src/store/geojson.ts`**

```ts
import type { TrafficLight } from '../types';
import { normalizeBearing } from '../geo/geo';

export interface LightFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Omit<TrafficLight, 'lat' | 'lon'>;
}
export interface LightFeatureCollection {
  type: 'FeatureCollection';
  features: LightFeature[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function lightsToGeoJSON(lights: TrafficLight[]): LightFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lights.map(({ lat, lon, ...rest }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: rest,
    })),
  };
}

function parseFeature(f: unknown, now: () => string): TrafficLight | null {
  if (!isObj(f)) return null;
  const g = f.geometry;
  const p = f.properties;
  if (!isObj(g) || g.type !== 'Point' || !Array.isArray(g.coordinates)) return null;
  const [lon, lat] = g.coordinates as unknown[];
  if (typeof lon !== 'number' || typeof lat !== 'number') return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  if (!isObj(p)) return null;
  if (typeof p.id !== 'string' || p.id === '') return null;
  const ab = p.approachBearing;
  if (typeof ab !== 'number' || !Number.isFinite(ab) || ab < 0 || ab > 360) return null;

  const light: TrafficLight = {
    id: p.id,
    lat,
    lon,
    approachBearing: normalizeBearing(ab),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : now(),
    source: 'manual',
  };
  if (typeof p.name === 'string' && p.name.trim() !== '') light.name = p.name.trim();
  return light;
}

export function parseLightsGeoJSON(
  data: unknown,
  now: () => string = () => new Date().toISOString(),
): { lights: TrafficLight[]; rejected: number } {
  if (!isObj(data) || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Arquivo não é um GeoJSON FeatureCollection');
  }
  const lights: TrafficLight[] = [];
  let rejected = 0;
  for (const f of data.features) {
    const light = parseFeature(f, now);
    if (light) lights.push(light);
    else rejected++;
  }
  return { lights, rejected };
}

export function mergeLights(base: TrafficLight[], local: TrafficLight[], deletedIds: string[] = []): TrafficLight[] {
  const deleted = new Set(deletedIds);
  const byId = new Map<string, TrafficLight>();
  for (const l of base) byId.set(l.id, l);
  for (const l of local) byId.set(l.id, l);
  return [...byId.values()].filter((l) => !deleted.has(l.id));
}
```

- [ ] **Step 4: Implementar `src/store/localState.ts`**

```ts
import type { LocalState, TrafficLight } from '../types';

export function upsertLight(s: LocalState, light: TrafficLight): LocalState {
  return {
    lights: [...s.lights.filter((l) => l.id !== light.id), light],
    deleted: s.deleted.filter((id) => id !== light.id),
  };
}

export function removeLight(s: LocalState, id: string): LocalState {
  return {
    lights: s.lights.filter((l) => l.id !== id),
    deleted: s.deleted.includes(id) ? s.deleted : [...s.deleted, id],
  };
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/store`
Expected: PASS.

- [ ] **Step 6: Implementar `src/store/localStore.ts`** (código do navegador, sem teste unitário)

```ts
import type { LocalState, TrafficLight } from '../types';
import { lightsToGeoJSON, parseLightsGeoJSON } from './geojson';

const KEY = 'semaforo-niteroi:v1';

export function loadLocal(): LocalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { lights: [], deleted: [] };
    const obj = JSON.parse(raw) as { collection?: unknown; deleted?: unknown };
    const { lights } = parseLightsGeoJSON(obj.collection);
    const deleted = Array.isArray(obj.deleted) ? obj.deleted.filter((x): x is string => typeof x === 'string') : [];
    return { lights, deleted };
  } catch {
    return { lights: [], deleted: [] };
  }
}

export function saveLocal(s: LocalState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ collection: lightsToGeoJSON(s.lights), deleted: s.deleted }));
  } catch {
    // armazenamento indisponível (modo privado etc.): segue sem persistir
  }
}

export async function loadBaseLights(url: string): Promise<{ lights: TrafficLight[]; warning?: string }> {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { lights: parseLightsGeoJSON(await r.json()).lights };
  } catch {
    return { lights: [], warning: 'Base de semáforos não carregou; usando só os cadastros deste aparelho.' };
  }
}

export function downloadGeoJSON(lights: TrafficLight[], filename = 'traffic_lights.geojson'): void {
  const blob = new Blob([JSON.stringify(lightsToGeoJSON(lights), null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 7: Criar `public/data/traffic_lights.geojson`**

```json
{
  "type": "FeatureCollection",
  "features": []
}
```

- [ ] **Step 8: Typecheck e commit**

Run: `npx tsc --noEmit`
Expected: nenhuma saída (sem erros).

```powershell
git add src/store public/data
git commit -m "feat(store): GeoJSON, merge base+local, localStorage`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: matchRoad, allowedBearing, nearestName

**Files:**
- Create: `src/roads/match.ts`
- Test: `src/roads/match.test.ts`

- [ ] **Step 1: Escrever o teste com falha**

```ts
import { describe, it, expect } from 'vitest';
import { allowedBearing, matchRoad, nearestName } from './match';
import { angleDiff, destination } from '../geo/geo';
import type { LatLon, RoadSegment } from '../types';

const O = { lat: -22.9, lon: -43.1 };

/** Segmento reto de 100 m centrado em `center`, com a geometria apontando para `bearing`. */
function line(id: string, center: LatLon, bearing: number, oneway: 0 | 1 | -1 = 0, name: string | null = null): RoadSegment {
  const a = destination(center, bearing + 180, 50);
  const b = destination(center, bearing, 50);
  return { id, name, oneway, coords: [[a.lon, a.lat], [b.lon, b.lat]] };
}

const NS_EAST5 = line('ns', destination(O, 90, 5), 0); // norte-sul, 5 m a leste
const EW_NORTH15 = line('ew', destination(O, 0, 15), 90); // leste-oeste, 15 m ao norte

describe('matchRoad', () => {
  it('rumo norte → via norte-sul', () => {
    expect(matchRoad(O, 0, [NS_EAST5, EW_NORTH15])?.segment.id).toBe('ns');
  });

  it('rumo leste → via leste-oeste (alinhamento pesa mais que 10 m)', () => {
    expect(matchRoad(O, 90, [NS_EAST5, EW_NORTH15])?.segment.id).toBe('ew');
  });

  it('sem heading → a mais próxima', () => {
    expect(matchRoad(O, null, [NS_EAST5, EW_NORTH15])?.segment.id).toBe('ns');
  });

  it('nada a menos de 25 m → null', () => {
    expect(matchRoad(O, 0, [line('far', destination(O, 90, 30), 0)])).toBeNull();
  });

  it('rumo sul também casa com a via norte-sul (alinhamento ignora sentido)', () => {
    expect(matchRoad(O, 180, [NS_EAST5, EW_NORTH15])?.segment.id).toBe('ns');
  });

  it('histerese: mantém a anterior se a nova não for ≥ 5 melhor', () => {
    const east = line('east', destination(O, 90, 5), 0);
    const west = line('west', destination(O, 270, 8), 0);
    expect(matchRoad(O, 0, [east, west])?.segment.id).toBe('east');
    expect(matchRoad(O, 0, [east, west], 'west')?.segment.id).toBe('west');
  });

  it('histerese: troca se a nova for ≥ 5 melhor', () => {
    const east = line('east', destination(O, 90, 2), 0);
    const west = line('west', destination(O, 270, 8), 0);
    expect(matchRoad(O, 0, [east, west], 'west')?.segment.id).toBe('east');
  });
});

describe('allowedBearing', () => {
  it('oneway 1 → sentido da geometria; -1 → oposto; 0 → null', () => {
    const m1 = matchRoad(O, 0, [line('a', destination(O, 90, 5), 0, 1)])!;
    const m2 = matchRoad(O, 0, [line('a', destination(O, 90, 5), 0, -1)])!;
    const m0 = matchRoad(O, 0, [line('a', destination(O, 90, 5), 0, 0)])!;
    expect(angleDiff(allowedBearing(m1)!, 0)).toBeLessThan(0.5);
    expect(angleDiff(allowedBearing(m2)!, 180)).toBeLessThan(0.5);
    expect(allowedBearing(m0)).toBeNull();
  });
});

describe('nearestName', () => {
  it('retorna o nome mais próximo até 15 m', () => {
    const segs = [line('n1', destination(O, 90, 10), 0, 0, 'Rua A'), line('n2', destination(O, 90, 4), 0, 0, 'Rua B')];
    expect(nearestName(O, segs)).toBe('Rua B');
  });
  it('null se não houver nome perto', () => {
    expect(nearestName(O, [line('n1', destination(O, 90, 20), 0, 0, 'Rua A')])).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/roads/match`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/roads/match.ts`**

```ts
import type { LatLon, RoadSegment } from '../types';
import { angleDiff, normalizeBearing, pointToSegment } from '../geo/geo';

export const MATCH_DEFAULTS = { maxDistance: 25, anglePenalty: 0.5, hysteresis: 5 };

export interface RoadMatch {
  segment: RoadSegment;
  distance: number;
  segmentBearing: number; // bearing do sub-trecho na ordem da geometria
  cost: number;
}

function bestForSegment(
  pos: LatLon,
  heading: number | null,
  seg: RoadSegment,
  opts: typeof MATCH_DEFAULTS,
): RoadMatch | null {
  let best: RoadMatch | null = null;
  for (let i = 0; i < seg.coords.length - 1; i++) {
    const r = pointToSegment(pos, seg.coords[i], seg.coords[i + 1]);
    if (r.distance > opts.maxDistance) continue;
    const align = heading === null ? 0 : Math.min(angleDiff(heading, r.bearing), angleDiff(heading, r.bearing + 180));
    const cost = r.distance + opts.anglePenalty * align;
    if (!best || cost < best.cost) best = { segment: seg, distance: r.distance, segmentBearing: r.bearing, cost };
  }
  return best;
}

export function matchRoad(
  pos: LatLon,
  heading: number | null,
  segments: RoadSegment[],
  prevId: string | null = null,
  opts = MATCH_DEFAULTS,
): RoadMatch | null {
  let best: RoadMatch | null = null;
  let prev: RoadMatch | null = null;
  for (const seg of segments) {
    const m = bestForSegment(pos, heading, seg, opts);
    if (!m) continue;
    if (!best || m.cost < best.cost) best = m;
    if (prevId !== null && seg.id === prevId && (!prev || m.cost < prev.cost)) prev = m;
  }
  if (prev && best && best !== prev && best.cost > prev.cost - opts.hysteresis) return prev;
  return best;
}

/** Sentido permitido (graus) numa via de mão única; null se mão dupla. */
export function allowedBearing(m: RoadMatch): number | null {
  if (m.segment.oneway === 1) return m.segmentBearing;
  if (m.segment.oneway === -1) return normalizeBearing(m.segmentBearing + 180);
  return null;
}

export function nearestName(pos: LatLon, segments: RoadSegment[], maxDistance = 15): string | null {
  let best: { d: number; name: string } | null = null;
  for (const seg of segments) {
    if (!seg.name) continue;
    for (let i = 0; i < seg.coords.length - 1; i++) {
      const d = pointToSegment(pos, seg.coords[i], seg.coords[i + 1]).distance;
      if (d <= maxDistance && (!best || d < best.d)) best = { d, name: seg.name };
    }
  }
  return best?.name ?? null;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/roads/match`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/roads/match.ts src/roads/match.test.ts
git commit -m "feat(roads): matchRoad com custo distância+alinhamento e histerese`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: WrongWayDetector

**Files:**
- Create: `src/roads/wrongWay.ts`
- Test: `src/roads/wrongWay.test.ts`

- [ ] **Step 1: Escrever o teste com falha**

```ts
import { describe, it, expect } from 'vitest';
import { WrongWayDetector } from './wrongWay';
import type { RoadMatch } from './match';
import type { Fix } from '../types';

const match = (oneway: 0 | 1 | -1, distance = 3): RoadMatch => ({
  segment: { id: 'a', name: null, oneway, coords: [[0, 0], [0, 1]] },
  distance,
  segmentBearing: 0,
  cost: distance,
});
const fix = (accuracy = 5, speed: number | null = 10): Fix => ({
  lat: 0, lon: 0, accuracy, speed, heading: null, timestamp: 0,
});

function run(d: WrongWayDetector, n: number, input: Parameters<WrongWayDetector['update']>[0]): boolean[] {
  return Array.from({ length: n }, () => d.update(input));
}

describe('WrongWayDetector', () => {
  it('dispara só na 3ª leitura consecutiva na contramão', () => {
    expect(run(new WrongWayDetector(), 3, { match: match(1), fix: fix(), heading: 180 })).toEqual([false, false, true]);
  });

  it('não dispara com GPS impreciso', () => {
    expect(run(new WrongWayDetector(), 5, { match: match(1), fix: fix(20), heading: 180 })).not.toContain(true);
  });

  it('não dispara em velocidade baixa ou desconhecida', () => {
    expect(run(new WrongWayDetector(), 5, { match: match(1), fix: fix(5, 2), heading: 180 })).not.toContain(true);
    expect(run(new WrongWayDetector(), 5, { match: match(1), fix: fix(5, null), heading: 180 })).not.toContain(true);
  });

  it('não dispara em mão dupla', () => {
    expect(run(new WrongWayDetector(), 5, { match: match(0), fix: fix(), heading: 180 })).not.toContain(true);
  });

  it('não dispara com ângulo ≤ 135°', () => {
    expect(run(new WrongWayDetector(), 5, { match: match(1), fix: fix(), heading: 130 })).not.toContain(true);
  });

  it('não dispara longe da via (> 12 m) nem sem via', () => {
    expect(run(new WrongWayDetector(), 5, { match: match(1, 15), fix: fix(), heading: 180 })).not.toContain(true);
    expect(run(new WrongWayDetector(), 5, { match: null, fix: fix(), heading: 180 })).not.toContain(true);
  });

  it('oneway -1: rumo igual à geometria é contramão', () => {
    expect(run(new WrongWayDetector(), 3, { match: match(-1), fix: fix(), heading: 0 })).toEqual([false, false, true]);
  });

  it('desliga após 3 leituras normais', () => {
    const d = new WrongWayDetector();
    run(d, 3, { match: match(1), fix: fix(), heading: 180 });
    expect(run(d, 3, { match: match(1), fix: fix(), heading: 0 })).toEqual([true, true, false]);
  });

  it('leitura normal no meio zera a contagem', () => {
    const d = new WrongWayDetector();
    run(d, 2, { match: match(1), fix: fix(), heading: 180 });
    d.update({ match: match(1), fix: fix(), heading: 0 });
    expect(run(d, 2, { match: match(1), fix: fix(), heading: 180 })).toEqual([false, false]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/roads/wrongWay`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/roads/wrongWay.ts`**

```ts
import type { Fix } from '../types';
import { angleDiff } from '../geo/geo';
import { allowedBearing, type RoadMatch } from './match';

export const WRONG_WAY_DEFAULTS = {
  maxAccuracy: 15,
  maxDistance: 12,
  minSpeed: 2.8,
  minAngle: 135,
  triggerCount: 3,
  clearCount: 3,
};

export interface WrongWayInput {
  match: RoadMatch | null;
  fix: Fix;
  heading: number | null;
}

export class WrongWayDetector {
  private bad = 0;
  private good = 0;
  private active = false;
  private readonly opts: typeof WRONG_WAY_DEFAULTS;

  constructor(opts: typeof WRONG_WAY_DEFAULTS = WRONG_WAY_DEFAULTS) {
    this.opts = opts;
  }

  private isWrongWay({ match, fix, heading }: WrongWayInput): boolean {
    if (!match || heading === null || fix.speed === null) return false;
    const allowed = allowedBearing(match);
    if (allowed === null) return false;
    return (
      fix.accuracy <= this.opts.maxAccuracy &&
      match.distance <= this.opts.maxDistance &&
      fix.speed >= this.opts.minSpeed &&
      angleDiff(heading, allowed) > this.opts.minAngle
    );
  }

  update(input: WrongWayInput): boolean {
    if (this.isWrongWay(input)) {
      this.bad++;
      this.good = 0;
      if (this.bad >= this.opts.triggerCount) this.active = true;
    } else {
      this.good++;
      this.bad = 0;
      if (this.good >= this.opts.clearCount) this.active = false;
    }
    return this.active;
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/roads/wrongWay`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/roads/wrongWay.ts src/roads/wrongWay.test.ts
git commit -m "feat(roads): detector de contramão com limiares conservadores`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Vias a partir dos tiles vetoriais

**Files:**
- Create: `src/roads/tileRoads.ts`
- Test: `src/roads/tileRoads.test.ts`

- [ ] **Step 1: Escrever o teste com falha**

```ts
import { describe, it, expect } from 'vitest';
import { featuresToSegments, filterNear } from './tileRoads';
import { destination } from '../geo/geo';
import type { RoadSegment } from '../types';

const feat = (props: Record<string, unknown>, geometry: { type: string; coordinates?: unknown }, id?: number) => ({
  id, properties: props, geometry,
});
const LINE = { type: 'LineString', coordinates: [[-43.1, -22.9], [-43.1, -22.899]] };

describe('featuresToSegments', () => {
  it('LineString de via primária com oneway 1', () => {
    const [s] = featuresToSegments([feat({ class: 'primary', oneway: 1 }, LINE, 7)]);
    expect(s).toEqual({ id: '7:0', name: null, oneway: 1, coords: [[-43.1, -22.9], [-43.1, -22.899]] });
  });

  it('MultiLineString vira um segmento por linha', () => {
    const multi = { type: 'MultiLineString', coordinates: [LINE.coordinates, LINE.coordinates] };
    expect(featuresToSegments([feat({ class: 'minor' }, multi, 1)]).map((s) => s.id)).toEqual(['1:0', '1:1']);
  });

  it('oneway ausente ou diferente de ±1 → 0', () => {
    expect(featuresToSegments([feat({ class: 'minor', oneway: 0 }, LINE)])[0].oneway).toBe(0);
    expect(featuresToSegments([feat({ class: 'minor' }, LINE)])[0].oneway).toBe(0);
  });

  it('ignora path, ferrovia e service de estacionamento', () => {
    const r = featuresToSegments([
      feat({ class: 'path' }, LINE),
      feat({ class: 'rail' }, LINE),
      feat({ class: 'service', service: 'parking_aisle' }, LINE),
      feat({ class: 'service' }, LINE),
    ]);
    expect(r).toHaveLength(1);
  });

  it('sem exigir classe (camada de nomes) mantém o nome', () => {
    const [s] = featuresToSegments([feat({ name: 'Rua da Conceição' }, LINE)], false);
    expect(s.name).toBe('Rua da Conceição');
  });

  it('ignora geometrias inválidas', () => {
    expect(featuresToSegments([
      feat({ class: 'minor' }, { type: 'LineString', coordinates: [[-43.1, -22.9]] }),
      feat({ class: 'minor' }, { type: 'Point', coordinates: [-43.1, -22.9] }),
      feat({ class: 'minor' }, { type: 'LineString', coordinates: [['x', 1], [2, 3]] }),
    ])).toEqual([]);
  });
});

describe('filterNear', () => {
  const O = { lat: -22.9, lon: -43.1 };
  const seg = (id: string, a: { lat: number; lon: number }, b: { lat: number; lon: number }): RoadSegment => ({
    id, name: null, oneway: 0, coords: [[a.lon, a.lat], [b.lon, b.lat]],
  });

  it('mantém perto, descarta longe e mantém segmento longo que cruza a área', () => {
    const near = seg('near', destination(O, 0, 10), destination(O, 0, 30));
    const far = seg('far', destination(O, 0, 1000), destination(O, 0, 1100));
    const crossing = seg('cross', destination(O, 270, 500), destination(O, 90, 500));
    expect(filterNear([near, far, crossing], O, 40).map((s) => s.id)).toEqual(['near', 'cross']);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/roads/tileRoads`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/roads/tileRoads.ts`**

```ts
import type { Map as MlMap } from 'maplibre-gl';
import type { LatLon, RoadSegment, RoadSource } from '../types';

/** Classes do esquema OpenMapTiles (camada `transportation`) consideradas vias de carro. */
const ROAD_CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']);
const SOURCE_ID = 'openmaptiles';

export interface SourceFeature {
  id?: string | number;
  properties: Record<string, unknown> | null;
  geometry: { type: string; coordinates?: unknown };
}

function toLine(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: [number, number][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') return null;
    out.push([p[0], p[1]]);
  }
  return out;
}

export function featuresToSegments(features: SourceFeature[], requireRoadClass = true): RoadSegment[] {
  const out: RoadSegment[] = [];
  features.forEach((f, fi) => {
    const props = f.properties ?? {};
    if (requireRoadClass) {
      const cls = props.class;
      if (typeof cls !== 'string' || !ROAD_CLASSES.has(cls)) return;
      if (cls === 'service' && props.service === 'parking_aisle') return;
    }
    const name = typeof props.name === 'string' && props.name !== '' ? props.name : null;
    const oneway: 0 | 1 | -1 = props.oneway === 1 ? 1 : props.oneway === -1 ? -1 : 0;

    let lines: unknown[] = [];
    if (f.geometry.type === 'LineString') lines = [f.geometry.coordinates];
    else if (f.geometry.type === 'MultiLineString' && Array.isArray(f.geometry.coordinates)) lines = f.geometry.coordinates;

    lines.forEach((raw, li) => {
      const coords = toLine(raw);
      if (coords) out.push({ id: `${f.id ?? `f${fi}`}:${li}`, name, oneway, coords });
    });
  });
  return out;
}

/** Mantém segmentos cujo retângulo envolvente cruza o quadrado de lado 2×radiusM em volta do centro. */
export function filterNear(segments: RoadSegment[], center: LatLon, radiusM: number): RoadSegment[] {
  const dLat = radiusM / 111195;
  const dLon = dLat / Math.cos((center.lat * Math.PI) / 180);
  const minLat = center.lat - dLat;
  const maxLat = center.lat + dLat;
  const minLon = center.lon - dLon;
  const maxLon = center.lon + dLon;
  return segments.filter((s) => {
    let sMinLon = Infinity, sMaxLon = -Infinity, sMinLat = Infinity, sMaxLat = -Infinity;
    for (const [lon, lat] of s.coords) {
      if (lon < sMinLon) sMinLon = lon;
      if (lon > sMaxLon) sMaxLon = lon;
      if (lat < sMinLat) sMinLat = lat;
      if (lat > sMaxLat) sMaxLat = lat;
    }
    return sMaxLon >= minLon && sMinLon <= maxLon && sMaxLat >= minLat && sMinLat <= maxLat;
  });
}

/** Lê as vias dos tiles vetoriais já carregados no mapa (independe de a camada estar desenhada). */
export function createTileRoadSource(map: MlMap): RoadSource {
  const query = (sourceLayer: string, requireClass: boolean, lat: number, lon: number, r: number) =>
    filterNear(
      featuresToSegments(map.querySourceFeatures(SOURCE_ID, { sourceLayer }) as SourceFeature[], requireClass),
      { lat, lon },
      r,
    );
  return {
    segmentsNear: (lat, lon, r) => query('transportation', true, lat, lon, r),
    namedSegmentsNear: (lat, lon, r) => query('transportation_name', false, lat, lon, r),
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/roads`
Expected: PASS (match + wrongWay + tileRoads).

- [ ] **Step 5: Typecheck e commit**

Run: `npx tsc --noEmit`
Expected: sem erros. Se o cast `as SourceFeature[]` der erro de tipos incompatíveis, troque por `as unknown as SourceFeature[]`.

```powershell
git add src/roads/tileRoads.ts src/roads/tileRoads.test.ts
git commit -m "feat(roads): segmentos de via a partir dos tiles OpenMapTiles`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Fontes de localização

**Files:**
- Create: `src/location/simulated.ts`, `src/location/browserGps.ts`
- Test: `src/location/simulated.test.ts`

- [ ] **Step 1: Escrever o teste com falha**

```ts
import { describe, it, expect } from 'vitest';
import { makeSimFix, SimulatedSource } from './simulated';
import { destination } from '../geo/geo';
import type { Fix } from '../types';

const O = { lat: -22.9, lon: -43.1 };

describe('makeSimFix', () => {
  it('primeiro fix sem heading e sem velocidade', () => {
    expect(makeSimFix(null, O.lat, O.lon, 1000)).toEqual({ lat: O.lat, lon: O.lon, accuracy: 5, speed: null, heading: null, timestamp: 1000 });
  });

  it('calcula heading e velocidade a partir do anterior', () => {
    const prev = makeSimFix(null, O.lat, O.lon, 0);
    const P = destination(O, 90, 40);
    const f = makeSimFix(prev, P.lat, P.lon, 2000);
    expect(Math.abs(f.heading! - 90)).toBeLessThan(0.5);
    expect(f.speed!).toBeCloseTo(20, 1);
  });

  it('deslocamento < 1 m → heading null', () => {
    const prev = makeSimFix(null, O.lat, O.lon, 0);
    expect(makeSimFix(prev, O.lat, O.lon, 1000).heading).toBeNull();
  });
});

describe('SimulatedSource', () => {
  it('entrega fixes após start e para após stop', () => {
    const got: Fix[] = [];
    const s = new SimulatedSource();
    s.start((f) => got.push(f), () => {});
    s.moveTo(O.lat, O.lon, 0);
    s.stop();
    s.moveTo(O.lat, O.lon, 1000);
    expect(got).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/location`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/location/simulated.ts`**

```ts
import type { Fix, LocationSource } from '../types';
import { bearingDeg, distanceM } from '../geo/geo';

export function makeSimFix(prev: Fix | null, lat: number, lon: number, now: number): Fix {
  if (!prev) return { lat, lon, accuracy: 5, speed: null, heading: null, timestamp: now };
  const pos = { lat, lon };
  const d = distanceM(prev, pos);
  const dt = (now - prev.timestamp) / 1000;
  return {
    lat,
    lon,
    accuracy: 5,
    speed: dt > 0 ? d / dt : null,
    heading: d >= 1 ? bearingDeg(prev, pos) : null,
    timestamp: now,
  };
}

export class SimulatedSource implements LocationSource {
  private onFix: ((f: Fix) => void) | null = null;
  private last: Fix | null = null;

  start(onFix: (f: Fix) => void): void {
    this.onFix = onFix;
  }

  stop(): void {
    this.onFix = null;
  }

  moveTo(lat: number, lon: number, now: number = Date.now()): void {
    if (!this.onFix) return;
    const f = makeSimFix(this.last, lat, lon, now);
    this.last = f;
    this.onFix(f);
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/location`
Expected: PASS.

- [ ] **Step 5: Implementar `src/location/browserGps.ts`** (sem teste unitário; validado no celular)

```ts
import type { Fix, LocationSource } from '../types';

export class BrowserGpsSource implements LocationSource {
  private watchId: number | null = null;

  start(onFix: (f: Fix) => void, onError: (msg: string) => void): void {
    if (!('geolocation' in navigator)) {
      onError('GPS indisponível neste navegador');
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (p) =>
        onFix({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracy: p.coords.accuracy,
          speed: p.coords.speed,
          heading: p.coords.heading === null || Number.isNaN(p.coords.heading) ? null : p.coords.heading,
          timestamp: p.timestamp,
        }),
      (e) =>
        onError(
          e.code === e.PERMISSION_DENIED
            ? 'Sem permissão de localização. Libere a localização para este site nas configurações do navegador.'
            : 'GPS indisponível',
        ),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
  }

  stop(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }
}
```

- [ ] **Step 6: Typecheck e commit**

Run: `npx tsc --noEmit`
Expected: sem erros.

```powershell
git add src/location
git commit -m "feat(location): GPS do navegador e fonte simulada`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Componentes de exibição (painel, barra da rua, alerta, wake lock)

**Files:**
- Create: `src/ui/format.ts`, `src/ui/DriverPanel.tsx`, `src/ui/StreetBanner.tsx`, `src/ui/WrongWayAlert.tsx`, `src/ui/useWakeLock.ts`
- Test: `src/ui/format.test.ts`

- [ ] **Step 1: Escrever o teste com falha `src/ui/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { formatDistance } from './format';

describe('formatDistance', () => {
  it('arredonda para múltiplos de 5 m', () => {
    expect(formatDistance(123)).toBe('125 m');
    expect(formatDistance(87)).toBe('85 m');
    expect(formatDistance(2)).toBe('0 m');
  });
  it('km acima de 1000 m, com vírgula', () => {
    expect(formatDistance(1234)).toBe('1,2 km');
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/ui`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/ui/format.ts`**

```ts
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 5) * 5} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/ui`
Expected: PASS.

- [ ] **Step 5: Criar `src/ui/DriverPanel.tsx`**

```tsx
import type { Fix, NextResult } from '../types';
import { formatDistance } from './format';

export const MAX_ACCURACY_M = 30;

interface Props {
  fix: Fix | null;
  error: string | null;
  next: NextResult | null;
}

export function DriverPanel({ fix, error, next }: Props) {
  let main: string;
  let sub: string | null = null;
  let cls = 'panel';

  if (error) {
    main = error;
    cls += ' panel-error';
  } else if (!fix) {
    main = 'Procurando GPS…';
  } else if (fix.accuracy > MAX_ACCURACY_M) {
    main = `GPS impreciso (±${Math.round(fix.accuracy)} m)`;
  } else if (!next || next.kind === 'no-heading') {
    main = 'Aguardando movimento';
  } else if (next.kind === 'none') {
    main = 'Nenhum semáforo à frente';
  } else {
    main = `🚦 ${formatDistance(next.distance)}`;
    sub = next.light.name ?? null;
  }

  return (
    <div className={cls}>
      <div className={next?.kind === 'found' && !error ? 'panel-main panel-big' : 'panel-main'}>{main}</div>
      {sub && <div className="panel-sub">{sub}</div>}
    </div>
  );
}
```

- [ ] **Step 6: Criar `src/ui/StreetBanner.tsx`**

```tsx
export interface RoadInfo {
  name: string | null;
  oneway: 0 | 1 | -1;
  allowed: number | null; // sentido permitido (graus) se mão única
}

interface Props {
  road: RoadInfo | null;
  heading: number | null;
}

export function StreetBanner({ road, heading }: Props) {
  if (!road) return <div className="street-banner muted">Rua não identificada</div>;
  const name = road.name ?? 'Rua sem nome';

  if (road.oneway !== 0 && road.allowed !== null) {
    // seta relativa ao meu rumo: para cima = estou no sentido permitido
    const rotation = road.allowed - (heading ?? 0);
    return (
      <div className="street-banner">
        <span className="street-arrow" style={{ transform: `rotate(${rotation}deg)` }}>⬆</span>
        <div>
          <div className="street-name">{name}</div>
          <div className="street-kind">Mão única</div>
        </div>
      </div>
    );
  }

  return (
    <div className="street-banner">
      <span className="street-arrow">⇅</span>
      <div>
        <div className="street-name">{name}</div>
        <div className="street-kind">Mão dupla</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Criar `src/ui/WrongWayAlert.tsx`**

```tsx
export function WrongWayAlert({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="wrong-way" role="alert">
      <div className="wrong-way-title">⚠ POSSÍVEL CONTRAMÃO</div>
      <div className="wrong-way-sub">dado do mapa — confira a sinalização</div>
    </div>
  );
}
```

- [ ] **Step 8: Criar `src/ui/useWakeLock.ts`**

```ts
import { useEffect } from 'react';

/** Mantém a tela ligada enquanto `enabled`; reaplica ao voltar para a aba. Ignora se não houver suporte. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        // negado ou sem suporte: segue sem wake lock
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [enabled]);
}
```

- [ ] **Step 9: Typecheck e commit**

Run: `npx tsc --noEmit`
Expected: sem erros.

```powershell
git add src/ui
git commit -m "feat(ui): painel do motorista, barra da rua, alerta de contramão, wake lock`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: MapView (MapLibre)

**Files:**
- Create: `src/ui/MapView.tsx`

- [ ] **Step 1: Criar `src/ui/MapView.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection } from 'geojson';
import type { Fix, TrafficLight } from '../types';
import { lightsToGeoJSON } from '../store/geojson';
import { circlePolygon, destination } from '../geo/geo';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const NITEROI_CENTER: [number, number] = [-43.1036, -22.8832];
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface Draft {
  lat: number;
  lon: number;
  bearing: number | null;
}

interface Props {
  fix: Fix | null;
  heading: number | null;
  lights: TrafficLight[];
  nextId: string | null;
  follow: boolean;
  draft: Draft | null;
  onUserPan(): void;
  onMapClick(lat: number, lon: number): void;
  onLightClick(id: string, lat: number, lon: number): void;
  onReady(map: MlMap): void;
}

function arrowImage(): ImageData {
  const s = 48;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.moveTo(s / 2, 2);
  ctx.lineTo(s - 8, s - 6);
  ctx.lineTo(s / 2, s - 16);
  ctx.lineTo(8, s - 6);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
  return ctx.getImageData(0, 0, s, s);
}

function addLayers(map: MlMap): void {
  map.addImage('tl-arrow', arrowImage(), { pixelRatio: 2 });
  for (const id of ['lights', 'user', 'accuracy', 'draft']) map.addSource(id, { type: 'geojson', data: EMPTY });

  map.addLayer({ id: 'accuracy-fill', type: 'fill', source: 'accuracy', paint: { 'fill-color': '#2196f3', 'fill-opacity': 0.15 } });
  map.addLayer({
    id: 'lights-circle', type: 'circle', source: 'lights',
    paint: { 'circle-radius': 12, 'circle-color': '#e53935', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
  });
  map.addLayer({
    id: 'lights-arrow', type: 'symbol', source: 'lights',
    layout: {
      'icon-image': 'tl-arrow',
      'icon-rotate': ['get', 'approachBearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  map.addLayer({
    id: 'draft-line', type: 'line', source: 'draft', filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': '#ffc107', 'line-width': 4 },
  });
  map.addLayer({
    id: 'draft-point', type: 'circle', source: 'draft', filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 8, 'circle-color': '#ffc107', 'circle-stroke-color': '#000000', 'circle-stroke-width': 2 },
  });
  map.addLayer({
    id: 'user-dot', type: 'circle', source: 'user',
    paint: { 'circle-radius': 9, 'circle-color': '#2196f3', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
  });
}

export function MapView(props: Props) {
  const { fix, heading, lights, nextId, follow, draft } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: STYLE_URL,
      center: NITEROI_CENTER,
      zoom: 15,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on('load', () => {
      addLayers(map);
      setLoaded(true);
      cb.current.onReady(map);
    });
    map.on('dragstart', () => cb.current.onUserPan());
    map.on('click', (e) => {
      if (map.getLayer('lights-circle')) {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['lights-circle'] })[0];
        const id = hit?.properties?.id;
        if (hit && typeof id === 'string' && hit.geometry.type === 'Point') {
          const [lon, lat] = hit.geometry.coordinates;
          cb.current.onLightClick(id, lat, lon);
          return;
        }
      }
      cb.current.onMapClick(e.lngLat.lat, e.lngLat.lng);
    });
    return () => {
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (mapRef.current!.getSource('lights') as GeoJSONSource).setData(lightsToGeoJSON(lights));
  }, [loaded, lights]);

  useEffect(() => {
    if (!loaded) return;
    mapRef.current!.setPaintProperty('lights-circle', 'circle-color', [
      'case', ['==', ['get', 'id'], nextId ?? ''], '#ffc107', '#e53935',
    ]);
  }, [loaded, nextId]);

  useEffect(() => {
    if (!loaded) return;
    const map = mapRef.current!;
    const userData: FeatureCollection = fix
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [fix.lon, fix.lat] }, properties: {} }] }
      : EMPTY;
    const accData: FeatureCollection = fix
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circlePolygon(fix, fix.accuracy)] }, properties: {} }] }
      : EMPTY;
    (map.getSource('user') as GeoJSONSource).setData(userData);
    (map.getSource('accuracy') as GeoJSONSource).setData(accData);
  }, [loaded, fix]);

  useEffect(() => {
    if (!loaded || !follow || !fix) return;
    const map = mapRef.current!;
    map.easeTo({
      center: [fix.lon, fix.lat],
      bearing: heading ?? map.getBearing(),
      zoom: Math.max(map.getZoom(), 16.5),
      duration: 800,
    });
  }, [loaded, follow, fix, heading]);

  useEffect(() => {
    if (!loaded) return;
    const features: Feature[] = [];
    if (draft) {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [draft.lon, draft.lat] }, properties: {} });
      if (draft.bearing !== null) {
        const end = destination(draft, draft.bearing, 30);
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[draft.lon, draft.lat], [end.lon, end.lat]] },
          properties: {},
        });
      }
    }
    (mapRef.current!.getSource('draft') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
  }, [loaded, draft]);

  return <div ref={containerRef} className="map" />;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros. Correções conhecidas caso o TS reclame:
- filtro/expressão em `addLayer`: adicionar `as maplibregl.FilterSpecification` / `as maplibregl.ExpressionSpecification`;
- `setData(lightsToGeoJSON(lights))`: trocar por `setData(lightsToGeoJSON(lights) as unknown as FeatureCollection)`;
- `attributionControl: { compact: true }` não aceito: trocar por `attributionControl: false` e adicionar `map.addControl(new maplibregl.AttributionControl({ compact: true }))` logo após criar o mapa.

- [ ] **Step 3: Commit**

```powershell
git add src/ui/MapView.tsx
git commit -m "feat(ui): MapView com MapLibre, camadas de semáforos, usuário e rascunho`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Modo cadastro + App + estilos

**Files:**
- Create: `src/ui/EditPanel.tsx`
- Modify (substituir inteiro): `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Criar `src/ui/EditPanel.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { TrafficLight } from '../types';
import type { Draft } from './MapView';

interface Props {
  draft: Draft | null;
  selected: TrafficLight | null;
  message: string | null;
  onSaveDraft(name: string): void;
  onCancelDraft(): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  onCloseSelected(): void;
  onExport(): void;
  onImport(file: File): void;
  onExit(): void;
}

export function EditPanel(p: Props) {
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedId = p.selected?.id ?? null;

  useEffect(() => {
    setName(p.selected?.name ?? '');
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  let body;
  if (p.selected) {
    const sel = p.selected;
    body = (
      <>
        <div className="edit-title">Semáforo selecionado ({Math.round(sel.approachBearing)}°)</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (opcional)" />
        <div className="row">
          <button className="primary" onClick={() => p.onRename(sel.id, name)}>Salvar nome</button>
          <button className="danger" onClick={() => p.onDelete(sel.id)}>Excluir</button>
          <button onClick={p.onCloseSelected}>Fechar</button>
        </div>
      </>
    );
  } else if (!p.draft) {
    body = <div className="edit-hint">1. Toque no cruzamento onde fica o semáforo.</div>;
  } else if (p.draft.bearing === null) {
    body = (
      <div className="edit-hint">
        2. Toque num ponto <b>depois</b> do semáforo, na direção em que seguem os carros que ele controla.
      </div>
    );
  } else {
    body = (
      <>
        <div className="edit-hint">Sentido: {Math.round(p.draft.bearing)}°. Toque de novo no mapa para recomeçar.</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (opcional), ex.: Av. X × R. Y" />
        <div className="row">
          <button className="primary" onClick={() => { p.onSaveDraft(name); setName(''); }}>Salvar</button>
          <button onClick={p.onCancelDraft}>Cancelar</button>
        </div>
      </>
    );
  }

  return (
    <div className="edit-panel">
      <div className="edit-warning">✏️ Modo cadastro — use parado</div>
      {body}
      {p.message && <div className="edit-message">{p.message}</div>}
      <div className="row">
        <button onClick={p.onExport}>Exportar</button>
        <button onClick={() => fileRef.current?.click()}>Importar</button>
        <input
          ref={fileRef}
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) p.onImport(f);
            e.target.value = '';
          }}
        />
        <button onClick={p.onExit}>Sair</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Substituir `src/App.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import type { Fix, LocalState, NextResult, RoadSource, TrafficLight } from './types';
import { MapView, type Draft } from './ui/MapView';
import { DriverPanel } from './ui/DriverPanel';
import { StreetBanner, type RoadInfo } from './ui/StreetBanner';
import { WrongWayAlert } from './ui/WrongWayAlert';
import { EditPanel } from './ui/EditPanel';
import { useWakeLock } from './ui/useWakeLock';
import { HeadingTracker } from './nearest/heading';
import { findNextTrafficLight } from './nearest/nearest';
import { allowedBearing, matchRoad, nearestName, type RoadMatch } from './roads/match';
import { WrongWayDetector } from './roads/wrongWay';
import { createTileRoadSource } from './roads/tileRoads';
import { BrowserGpsSource } from './location/browserGps';
import { SimulatedSource } from './location/simulated';
import { mergeLights, parseLightsGeoJSON } from './store/geojson';
import { downloadGeoJSON, loadBaseLights, loadLocal, saveLocal } from './store/localStore';
import { removeLight, upsertLight } from './store/localState';
import { bearingDeg } from './geo/geo';

const BASE_LIGHTS_URL = `${import.meta.env.BASE_URL}data/traffic_lights.geojson`;
const ROAD_SEARCH_RADIUS_M = 40;

export default function App() {
  const [base, setBase] = useState<TrafficLight[]>([]);
  const [local, setLocal] = useState<LocalState>(() => loadLocal());
  const lights = useMemo(() => mergeLights(base, local.lights, local.deleted), [base, local]);
  const lightsRef = useRef(lights);
  lightsRef.current = lights;

  const [simulation, setSimulation] = useState(() => new URLSearchParams(window.location.search).has('sim'));
  const [mode, setMode] = useState<'drive' | 'edit'>('drive');
  const [fix, setFix] = useState<Fix | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [next, setNext] = useState<NextResult | null>(null);
  const [road, setRoad] = useState<RoadInfo | null>(null);
  const [wrongWay, setWrongWay] = useState(false);
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const headingTracker = useRef(new HeadingTracker());
  const wrongWayDetector = useRef(new WrongWayDetector());
  const prevNextId = useRef<string | null>(null);
  const prevRoadId = useRef<string | null>(null);
  const roadSource = useRef<RoadSource | null>(null);
  const simSource = useRef<SimulatedSource | null>(null);

  useWakeLock(mode === 'drive');

  useEffect(() => {
    void loadBaseLights(BASE_LIGHTS_URL).then((r) => {
      setBase(r.lights);
      if (r.warning) setMessage(r.warning);
    });
  }, []);

  useEffect(() => {
    saveLocal(local);
  }, [local]);

  const handleFix = useCallback((f: Fix) => {
    setError(null);
    const h = headingTracker.current.update(f);
    const pos = { lat: f.lat, lon: f.lon };

    const n = findNextTrafficLight(pos, h, lightsRef.current, prevNextId.current);
    prevNextId.current = n.kind === 'found' ? n.light.id : null;

    let match: RoadMatch | null = null;
    let info: RoadInfo | null = null;
    const rs = roadSource.current;
    if (rs) {
      match = matchRoad(pos, h, rs.segmentsNear(f.lat, f.lon, ROAD_SEARCH_RADIUS_M), prevRoadId.current);
      prevRoadId.current = match?.segment.id ?? null;
      if (match) {
        info = {
          name: match.segment.name ?? nearestName(pos, rs.namedSegmentsNear(f.lat, f.lon, ROAD_SEARCH_RADIUS_M)),
          oneway: match.segment.oneway,
          allowed: allowedBearing(match),
        };
      }
    }

    setWrongWay(wrongWayDetector.current.update({ match, fix: f, heading: h }));
    setFix(f);
    setHeading(h);
    setNext(n);
    setRoad(info);
  }, []);

  useEffect(() => {
    headingTracker.current = new HeadingTracker();
    wrongWayDetector.current = new WrongWayDetector();
    prevNextId.current = null;
    prevRoadId.current = null;
    setFix(null);
    setHeading(null);
    setNext(null);
    setRoad(null);
    setWrongWay(false);

    const src = simulation ? new SimulatedSource() : new BrowserGpsSource();
    simSource.current = src instanceof SimulatedSource ? src : null;
    src.start(handleFix, setError);
    return () => src.stop();
  }, [simulation, handleFix]);

  const onReady = useCallback((map: MlMap) => {
    roadSource.current = createTileRoadSource(map);
  }, []);

  const onMapClick = useCallback(
    (lat: number, lon: number) => {
      if (mode === 'edit') {
        setSelectedId(null);
        setDraft((d) => (!d || d.bearing !== null ? { lat, lon, bearing: null } : { ...d, bearing: bearingDeg(d, { lat, lon }) }));
        return;
      }
      simSource.current?.moveTo(lat, lon);
    },
    [mode],
  );

  const onLightClick = useCallback(
    (id: string, lat: number, lon: number) => {
      if (mode === 'edit') {
        setDraft(null);
        setSelectedId(id);
        return;
      }
      simSource.current?.moveTo(lat, lon);
    },
    [mode],
  );

  const selected = lights.find((l) => l.id === selectedId) ?? null;

  const saveDraft = (name: string) => {
    if (!draft || draft.bearing === null) return;
    const trimmed = name.trim();
    const light: TrafficLight = {
      id: crypto.randomUUID(),
      lat: draft.lat,
      lon: draft.lon,
      approachBearing: draft.bearing,
      createdAt: new Date().toISOString(),
      source: 'manual',
      ...(trimmed ? { name: trimmed } : {}),
    };
    setLocal((s) => upsertLight(s, light));
    setDraft(null);
    setMessage('Semáforo salvo.');
  };

  const rename = (id: string, name: string) => {
    const l = lights.find((x) => x.id === id);
    if (!l) return;
    const { name: _previous, ...rest } = l;
    const trimmed = name.trim();
    setLocal((s) => upsertLight(s, trimmed ? { ...rest, name: trimmed } : rest));
    setMessage('Nome salvo.');
  };

  const remove = (id: string) => {
    setLocal((s) => removeLight(s, id));
    setSelectedId(null);
    setMessage('Semáforo excluído.');
  };

  const importFile = async (file: File) => {
    try {
      const { lights: imported, rejected } = parseLightsGeoJSON(JSON.parse(await file.text()));
      setLocal((s) => imported.reduce(upsertLight, s));
      setMessage(`${imported.length} importado(s)${rejected ? `, ${rejected} rejeitado(s)` : ''}.`);
    } catch (e) {
      setMessage(`Erro ao importar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const toggleEdit = () => {
    setMode((m) => (m === 'edit' ? 'drive' : 'edit'));
    setDraft(null);
    setSelectedId(null);
    setMessage(null);
  };

  return (
    <div className="app">
      <MapView
        fix={fix}
        heading={heading}
        lights={lights}
        nextId={next?.kind === 'found' ? next.light.id : null}
        follow={follow && mode === 'drive'}
        draft={mode === 'edit' ? draft : null}
        onUserPan={() => setFollow(false)}
        onMapClick={onMapClick}
        onLightClick={onLightClick}
        onReady={onReady}
      />

      {mode === 'drive' && (
        <div className="top">
          <StreetBanner road={road} heading={heading} />
          <WrongWayAlert active={wrongWay} />
        </div>
      )}

      <div className="toolbar">
        {!follow && mode === 'drive' && (
          <button onClick={() => setFollow(true)} title="Seguir posição">🎯</button>
        )}
        <button className={mode === 'edit' ? 'active' : ''} onClick={toggleEdit} title="Modo cadastro">✏️</button>
        <button className={simulation ? 'active' : ''} onClick={() => setSimulation((s) => !s)} title="Simulação">🧪</button>
      </div>

      {simulation && mode === 'drive' && <div className="sim-hint">Simulação: clique no mapa para mover</div>}

      <div className="bottom">
        {mode === 'drive' && message && <div className="toast">{message}</div>}
        {mode === 'drive' ? (
          <DriverPanel fix={fix} error={error} next={next} />
        ) : (
          <EditPanel
            draft={draft}
            selected={selected}
            message={message}
            onSaveDraft={saveDraft}
            onCancelDraft={() => setDraft(null)}
            onRename={rename}
            onDelete={remove}
            onCloseSelected={() => setSelectedId(null)}
            onExport={() => downloadGeoJSON(lights)}
            onImport={(f) => void importFile(f)}
            onExit={toggleEdit}
          />
        )}
        <div className="disclaimer">
          Protótipo. Informação apenas indicativa. Dados © OpenStreetMap contributors, OpenFreeMap.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Substituir `src/index.css`**

```css
html, body, #root { margin: 0; height: 100%; }
body {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: #111;
  color: #fff;
  overscroll-behavior: none;
}
.app { position: relative; height: 100dvh; overflow: hidden; }
.map { position: absolute; inset: 0; }

.top { position: absolute; top: env(safe-area-inset-top, 0px); left: 0; right: 0; padding: 8px; pointer-events: none; }
.street-banner { display: flex; align-items: center; gap: 12px; background: rgba(17, 17, 17, 0.88); border-radius: 12px; padding: 10px 14px; }
.street-banner.muted { color: #aaa; font-size: 1.1rem; }
.street-arrow { font-size: 2.6rem; line-height: 1; display: inline-block; transition: transform 0.3s; }
.street-name { font-size: 1.35rem; font-weight: 700; }
.street-kind { font-size: 1rem; color: #ccc; }
.wrong-way { position: absolute; top: 8px; left: 8px; right: 8px; background: #d50000; color: #fff; text-align: center; padding: 18px 8px; border-radius: 12px; }
.wrong-way-title { font-size: 1.8rem; font-weight: 800; }
.wrong-way-sub { font-size: 0.95rem; }

.toolbar { position: absolute; right: 8px; top: calc(env(safe-area-inset-top, 0px) + 96px); display: flex; flex-direction: column; gap: 8px; }
.toolbar button { width: 52px; height: 52px; font-size: 1.5rem; border-radius: 50%; border: none; background: rgba(17, 17, 17, 0.88); color: #fff; }
.toolbar button.active { background: #ffc107; }
.sim-hint { position: absolute; left: 8px; top: calc(env(safe-area-inset-top, 0px) + 96px); background: #ffc107; color: #000; padding: 6px 10px; border-radius: 8px; font-size: 0.9rem; }

.bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 8px calc(env(safe-area-inset-bottom, 0px) + 4px); }
.panel { background: rgba(17, 17, 17, 0.92); border-radius: 16px; padding: 16px; text-align: center; }
.panel-main { font-size: 1.6rem; font-weight: 700; }
.panel-big { font-size: 3.2rem; font-weight: 800; }
.panel-sub { font-size: 1.1rem; color: #ccc; margin-top: 4px; }
.panel-error .panel-main { font-size: 1.2rem; color: #ff8a80; }
.toast { background: #333; padding: 6px 10px; border-radius: 8px; margin-bottom: 6px; font-size: 0.9rem; }
.disclaimer { font-size: 0.7rem; color: #ddd; text-align: center; margin-top: 4px; text-shadow: 0 0 3px #000; }

.edit-panel { background: rgba(17, 17, 17, 0.95); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.edit-warning { color: #ffc107; font-weight: 700; }
.edit-title { font-weight: 700; }
.edit-panel input { font-size: 1rem; padding: 8px; border-radius: 8px; border: 1px solid #555; background: #222; color: #fff; }
.edit-message { color: #8bc34a; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
.row button { flex: 1; padding: 10px; font-size: 1rem; border-radius: 8px; border: none; background: #333; color: #fff; }
.row button.primary { background: #2e7d32; }
.row button.danger { background: #c62828; }
```

- [ ] **Step 4: Typecheck, testes e build**

Run: `npx tsc --noEmit`
Expected: sem erros.
Run: `npm test`
Expected: todos passam.
Run: `npm run build`
Expected: build ok.

- [ ] **Step 5: Verificação manual no PC (simulação)**

Run: `npm run dev` (em background) e abrir `http://localhost:5173/semaforo-niteroi/?sim=1`.
Checar:
1. O mapa de Niterói carrega; aparece a faixa amarela "Simulação: clique no mapa para mover".
2. ✏️ → tocar num cruzamento → tocar um ponto adiante → aparece linha amarela → Salvar. Surge um círculo vermelho com seta no mapa.
3. ✏️ (sair). Clicar no mapa 3 vezes, a uns 40 m de distância entre cliques, numa rua que leve ao semáforo e no sentido da seta. O painel deve mostrar `🚦 N m` e o círculo fica amarelo.
4. Clicar seguindo no sentido oposto → "Nenhum semáforo à frente".
5. Barra superior mostra o nome da rua e "Mão única"/"Mão dupla" (zoom ≥ 15; depois de os tiles carregarem).
6. Numa rua de mão única conhecida, "dirigir" por cliques no sentido proibido (cliques a ~30 m, rápidos) → após 3 cliques aparece "⚠ POSSÍVEL CONTRAMÃO".
7. ✏️ → Exportar baixa `traffic_lights.geojson`.

Se o item 5 nunca mostrar a rua: no console do navegador rode `map.querySourceFeatures('openmaptiles', {sourceLayer: 'transportation'}).length` (exponha `window.map = map` temporariamente em `onReady`) para confirmar que há features; corrigir antes de seguir.

- [ ] **Step 6: Commit**

```powershell
git add src
git commit -m "feat(app): tela do motorista, modo cadastro e simulação integrados`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: PWA e ícones

**Files:**
- Create: `scripts/make-icons.ps1`, `public/icon-192.png`, `public/icon-512.png`
- Modify: `vite.config.ts`

- [ ] **Step 1: Criar `scripts/make-icons.ps1`**

```powershell
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\public'
foreach ($size in 192, 512) {
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
```

- [ ] **Step 2: Gerar os ícones**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/make-icons.ps1`
Expected: existem `public/icon-192.png` e `public/icon-512.png`.

- [ ] **Step 3: Substituir `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/semaforo-niteroi/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Semáforo Niterói',
        short_name: 'Semáforo',
        description: 'Protótipo: próximo semáforo e mão da rua via GPS',
        start_url: '/semaforo-niteroi/',
        scope: '/semaforo-niteroi/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Build e conferência**

Run: `npm run build`
Expected: build ok; `dist/manifest.webmanifest` e `dist/sw.js` existem.

- [ ] **Step 5: Commit**

```powershell
git add scripts public vite.config.ts
git commit -m "feat(pwa): manifest, service worker e ícones`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: GitHub + deploy no Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Criar `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```powershell
git add .github
git commit -m "ci: testes, build e deploy no GitHub Pages`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Conferir que nada privado será publicado**

Run: `git ls-files`
Expected: **não** aparece nenhum `docs/LAI_*` nem `data/raw/*`. Se aparecer, pare e avise.

- [ ] **Step 4: Criar o repositório público e enviar**

```powershell
gh repo create semaforo-niteroi --public --source . --remote origin --push
```
Expected: URL `https://github.com/matheusmoraesnascimento-beep/semaforo-niteroi`.

- [ ] **Step 5: Ativar o Pages via Actions**

```powershell
gh api -X POST repos/matheusmoraesnascimento-beep/semaforo-niteroi/pages -f build_type=workflow
```
Expected: JSON com `"build_type": "workflow"` (se responder 409 "already exists", tudo certo).

- [ ] **Step 6: Disparar e acompanhar o deploy**

```powershell
gh workflow run Deploy
gh run watch (gh run list --workflow Deploy --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```
Expected: run concluído com sucesso.

- [ ] **Step 7: Conferir o site**

Run: `Invoke-WebRequest -UseBasicParsing https://matheusmoraesnascimento-beep.github.io/semaforo-niteroi/ | Select-Object -ExpandProperty StatusCode`
Expected: `200`.

---

### Task 15: Validação no celular (manual, com o usuário)

- [ ] **Step 1:** Abrir `https://matheusmoraesnascimento-beep.github.io/semaforo-niteroi/` no Chrome do celular, permitir localização, "Adicionar à tela inicial".
- [ ] **Step 2:** Parado, cadastrar 5–10 semáforos conhecidos (✏️), um por sentido.
- [ ] **Step 3:** Exportar o GeoJSON e salvá-lo em `public/data/traffic_lights.geojson` no repositório; commit + push (vira a base para outros aparelhos).
- [ ] **Step 4:** Com outra pessoa dirigindo (ou celular no suporte, sem tocar), percorrer a rota e anotar: semáforo certo? distância coerente? nome e mão da rua certos? algum alerta de contramão falso?
- [ ] **Step 5:** Registrar os resultados em `docs/PESQUISA.md` (seção nova "Teste de campo v1") para calibrar os limiares.
