# Protótipo Mapa + GPS + Próximo Semáforo — Design

Data: 2026-10-03
Status: aprovado em conversa; aguardando revisão do spec escrito

## Objetivo

Primeira versão executável do app (fases 3 e 4 do roadmap): mostrar a posição do usuário num mapa, os semáforos cadastrados manualmente e a **distância até o próximo semáforo no sentido de deslocamento**. Rodar no navegador do celular via HTTPS (GitHub Pages) e ser instalável como PWA. Arquitetura preparada para virar app Android com Capacitor sem reescrita.

Critério de sucesso: dirigindo em Niterói, com 5–10 semáforos cadastrados, o painel mostra o semáforo correto à frente e a distância diminuindo; semáforos de ruas transversais ou do sentido oposto são ignorados.

## Fora do escopo (v1)

- Contador regressivo, estados 🔴🟡🟢, ciclos, planos, confidence score
- Map matching (identificar a via)
- GPS em segundo plano / tela apagada
- Backend, contas, sincronização entre aparelhos

## Stack

| Item | Escolha |
|---|---|
| Build | Vite + TypeScript |
| UI | React |
| Mapa | MapLibre GL JS via `react-map-gl` (entrada `react-map-gl/maplibre`) |
| Estilo do mapa | OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty`), sem chave |
| PWA | `vite-plugin-pwa` (manifest + service worker do app shell; tiles não são cacheados) |
| Testes | Vitest (lógica pura) |
| Deploy | GitHub Actions → GitHub Pages, repositório público `semaforo-niteroi` |
| Futuro | Capacitor (Android) |

## Modelo de dados

`TrafficLight`:

```ts
interface TrafficLight {
  id: string;            // uuid
  lat: number;
  lon: number;
  approachBearing: number; // 0–360°, direção de deslocamento dos veículos que este semáforo controla
  name?: string;         // ex.: "Av. Roberto Silveira × R. Mariz e Barros"
  createdAt: string;     // ISO 8601
  source: "manual";
}
```

Formato de arquivo: GeoJSON `FeatureCollection` de `Point` (coordenadas `[lon, lat]`), demais campos em `properties`.

Um cruzamento com semáforos para dois sentidos = dois registros, um por `approachBearing`.

Fontes de dados ao iniciar:
1. `public/data/traffic_lights.geojson` (base versionada no repositório)
2. `localStorage` (cadastros feitos no aparelho)

União por `id`; em conflito, o registro do `localStorage` vence.

## Componentes

```
src/
  geo/          distance (haversine, metros), bearing (0–360), angleDiff (0–180)
  nearest/      findNextTrafficLight(pos, heading, lights, prevId?) → resultado
  location/     LocationSource: interface + browserGps + simulated
  store/        carregar/mesclar/salvar semáforos; import/export GeoJSON
  ui/           App, MapView, DriverPanel, EditMode, SimControls
public/data/traffic_lights.geojson
```

Cada unidade tem uma responsabilidade; `geo/` e `nearest/` não importam React nem APIs do navegador.

### location/

```ts
interface Fix {
  lat: number; lon: number;
  accuracy: number;        // metros
  speed: number | null;    // m/s
  heading: number | null;  // graus, null se desconhecido
  timestamp: number;       // ms
}
interface LocationSource {
  start(onFix: (f: Fix) => void, onError: (e: string) => void): void;
  stop(): void;
}
```

- `browserGps`: `navigator.geolocation.watchPosition` com `enableHighAccuracy: true`.
- `simulated`: cada clique no mapa gera um `Fix`; `heading` = bearing do ponto anterior ao atual; `speed` = distância / tempo entre cliques; `accuracy` = 5.
- Capacitor depois: nova implementação da mesma interface.

### Heading efetivo

- Usar `fix.heading` se não-nulo **e** `speed ≥ 1,5 m/s`.
- Senão, se o deslocamento desde o último fix usado for ≥ 10 m, usar o bearing entre eles.
- Senão, manter o último heading válido.
- Sem heading válido ainda → painel "Aguardando movimento".

### nearest/ — regra do próximo semáforo

Candidato se **todas**:
1. distância ≤ 500 m;
2. `angleDiff(heading, bearing(pos → semáforo)) ≤ 35°` (está à frente);
3. `angleDiff(heading, approachBearing) ≤ 45°` (controla o meu sentido).

Escolha: menor distância. **Histerese**: se o semáforo anterior (`prevId`) continua candidato, só troca para outro se o novo estiver ≥ 20 m mais perto.

Exceção para distância < 25 m: ignorar a regra 2 (ao passar por cima, o bearing até o ponto fica instável); manter apenas regras 1 e 3.

Retorno:

```ts
type NextResult =
  | { kind: "found"; light: TrafficLight; distance: number }
  | { kind: "none" }
  | { kind: "no-heading" };
```

### store/

- `loadLights()`: busca o GeoJSON base + lê `localStorage`, mescla.
- `saveLocal(lights)`: grava só os registros criados/alterados no aparelho.
- `exportGeoJSON(lights)`: gera arquivo para download (`traffic_lights.geojson`).
- `importGeoJSON(file)`: valida (tipo Point, lat/lon numéricos, `approachBearing` 0–360) e mescla; rejeita features inválidas informando quantas.
- Excluir semáforo: disponível no modo cadastro.

### ui/

**Tela do motorista (padrão)**
- Mapa segue a posição e gira conforme o heading efetivo (modo "seguir"); arrastar o mapa desliga o seguir, botão 🎯 religa.
- Marcador de posição + círculo de precisão.
- Ícones dos semáforos com pequena seta indicando `approachBearing`; próximo semáforo destacado.
- `DriverPanel` fixo embaixo, fonte grande:
  - `🚦 120 m` + nome (se houver)
  - `Nenhum semáforo à frente`
  - `Aguardando movimento`
  - `GPS impreciso (±45 m)` quando `accuracy > 30`
  - `Sem permissão de localização` / `GPS indisponível` em erro
- Wake Lock (`navigator.wakeLock.request("screen")`) quando suportado; reaplicar ao voltar à aba.
- Nenhuma interação necessária durante a direção.

**Modo cadastro (botão ✏️)**
- Aviso fixo: "Use parado".
- Toque no mapa → define posição; arrastar a partir dela → define `approachBearing` (seta de pré-visualização); campo opcional de nome; Salvar/Cancelar.
- Tocar num semáforo existente → editar nome / excluir.
- Botões Exportar / Importar GeoJSON.

**Simulação (botão 🧪, também via `?sim=1`)**
- Troca a fonte de localização para `simulated`; cliques no mapa (fora do modo cadastro) movem a posição.

## Tratamento de erros

| Situação | Comportamento |
|---|---|
| Permissão de GPS negada | Painel com mensagem + instrução para liberar nas configurações |
| `accuracy > 30 m` | Distância oculta, mostra "GPS impreciso (±N m)" |
| GeoJSON base não carrega | Segue só com `localStorage`, aviso discreto |
| GeoJSON importado inválido | Importa válidos, informa quantos foram rejeitados |
| Wake Lock indisponível | Ignora silenciosamente |
| Estilo do mapa não carrega (offline) | Painel continua funcionando (lógica não depende do mapa) |

## Testes

Vitest, foco em `geo/` e `nearest/`:
- haversine com distâncias conhecidas em Niterói (tolerância 1%);
- bearing nos 4 pontos cardeais e cruzando 0°/360°;
- angleDiff com wrap (350° vs 10° = 20°);
- nearest: semáforo à frente no meu sentido → found; à frente mas sentido oposto → none; atrás → none; transversal → none; > 500 m → none; dois candidatos → mais perto; histerese; < 25 m ignora regra 2; sem heading → no-heading;
- heading efetivo: GPS com velocidade, parado mantém último, fallback por deslocamento;
- store: merge base + local (local vence), import rejeita inválidos.

UI validada manualmente: simulação no PC e teste real no carro.

## Repositório e publicação

- Pasta do projeto: `C:\Users\mathe\OneDrive\Área de Trabalho\Semaforo Niteroi` (repo git).
- Repositório GitHub **público** `semaforo-niteroi`.
- `.gitignore` exclui `docs/LAI_*` (contém nº de protocolo) e `data/raw/` (cópia do mapa NitTrans).
- Workflow GitHub Actions: `npm ci` → `npm test` → `npm run build` → deploy Pages. `base` do Vite = `/semaforo-niteroi/`.
- Rodapé discreto: "Protótipo. Informação apenas indicativa. Dados © OpenStreetMap contributors, OpenFreeMap."
