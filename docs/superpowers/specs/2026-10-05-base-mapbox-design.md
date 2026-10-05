# Base Mapbox — mapa, ruas e rotas com trânsito

Sub-projeto 1 de 3 da evolução "app parecido com o Google Maps, com o semáforo como diferencial".
Os outros dois (2: navegação curva a curva/ETA/alternativas/paradas; 3: recentes/favoritos e segundo plano) têm specs próprios e dependem deste.

## Objetivo e contexto

Uso pessoal, Android (Capacitor) e web, de carro, Niterói. O app precisa de rotas com **trânsito real**. O Mapbox Directions (`driving-traffic`) atende, mas seus termos só permitem usar os resultados com mapa fornecido pelo Mapbox. Por isso o mapa passa a ser o do Mapbox.

Sucesso: o app abre com o mapa do Mapbox, a leitura de nome/mão da rua e o alerta de contramão continuam funcionando, e a rota traçada vem do Mapbox com tempo que considera o trânsito. Semáforos, GPS, câmera de navegação e busca não mudam de comportamento.

## Decisões

- **Mapa:** `mapbox-gl` v3 no lugar de `maplibre-gl`, estilo `mapbox://styles/mapbox/streets-v12`. Token público `pk.…` em `VITE_MAPBOX_TOKEN` (`.env.local`, já ignorado pelo git). Cota web: 50 mil map loads/mês grátis.
- **Rotas:** Mapbox Directions, perfil `driving-traffic`, `geometries=geojson`, `overview=full`, `language=pt-BR`. Substitui o OSRM em `routing/route.ts`. Nada da resposta é armazenado (termos do Directions).
- **Busca:** continua no Photon. O geocoding grátis do Mapbox é "temporary" (não pode guardar resultados) e o app guarda Casa/Trabalho, e depois recentes e favoritos.
- **Escopo fora:** passos de manobra, alternativas, cor de trânsito, paradas (sub-projeto 2).

## Mudanças

1. **Dependência e inicialização** (`ui/MapView.tsx`): trocar imports e tipos para `mapbox-gl`; remover o `setWorkerUrl`/`?worker&url`, que era contorno do MapLibre; `mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN`. Sem token, mostrar o erro já existente (`map-error`) com mensagem clara em vez de mapa cinza.
2. **Camadas próprias** (semáforos, rota, posição, rascunho): mesma API de fontes/camadas GeoJSON; só ajustar tipos. O `STYLE_URL` exportado passa a apontar para o estilo Mapbox.
3. **Leitura de ruas** (`roads/tileRoads.ts`): hoje lê o esquema OpenMapTiles (`transportation`, `transportation_name`, fonte `openmaptiles`). No estilo Mapbox é a camada `road` da fonte `composite`, com `class` (`motorway`, `trunk`, `primary`, `secondary`, `tertiary`, `street`, `street_limited`, `service`…), `name` e `oneway` como texto `'true'`/`'false'`. Adaptar `featuresToSegments` e `createTileRoadSource`; manter o contrato `RoadSource` e `RoadSegment`. Os nomes das propriedades devem ser confirmados lendo features reais do mapa antes de fixar os testes.
4. **Rotas** (`routing/route.ts`): `fetchRoute(from, to)` mantém a assinatura e o `RouteResult` (`line`, `distanceM`, `durationS`); `durationS` passa a ser a duração com trânsito (`duration` do perfil `driving-traffic`). Mesmos `ServiceError` (`network`, `http`, `format`, `no-route`; `NoRoute` do Mapbox → `no-route`; 401/403 → `http`).
5. **Tipos de plataforma:** `vite-env.d.ts` com `VITE_MAPBOX_TOKEN`.
6. **Build web (GitHub Pages) e Android:** o token entra no bundle em ambos. Restringir o token por URL no painel do Mapbox (origens do Pages e `https://localhost` do Capacitor).

## Tratamento de erro

- Token ausente ou inválido: mensagem no mapa; busca (Photon) continua.
- Directions fora do ar, 4xx/5xx ou 429: `ServiceError` → mensagem "O serviço respondeu com erro" já existente.
- Sem rede: comportamento atual ("Sem conexão").

## Testes

- `route.test.ts`: reescrever com respostas do Directions (rota ok, `NoRoute`, 401, corpo fora do formato, falha de rede).
- `tileRoads.test.ts`: reescrever com features no esquema `road` do Mapbox.
- Demais testes (match, wrongWay, offRoute, geocode…) não mudam.
- Manual (emulador Android com a CA do proxy ou celular): mapa carrega, `?sim` move o carro, nome da rua e mão única aparecem, rota traçada mostra tempo diferente do OSRM em horário de trânsito.

## Riscos

- Termos do Mapbox mudam: confirmar a versão atual antes de publicar (a restrição "só com mapa Mapbox" foi lida em versão arquivada).
- `querySourceFeatures` em `composite` pode devolver geometrias recortadas por tile; o código atual já deduplica por id derivado dos dados.
- `mapbox-gl` v3 é proprietário e exige token; sem internet o mapa não carrega (já era o caso com tiles remotos).
