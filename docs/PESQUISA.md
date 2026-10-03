# Pesquisa de fontes de dados — Fase 1

Última atualização: 2026-10-03

## Resumo

| Fonte | Localização dos semáforos | Programação (ciclo/fases) | Estado em tempo real | Status |
|---|---|---|---|---|
| ArcGIS REST Prefeitura | ❌ | ❌ | ❌ | Verificado |
| Site NitTrans | 🟡 só imagem PNG | ❌ | ❌ | Verificado |
| OpenStreetMap | ? | ❌ | ❌ | Pendente (Overpass com timeout) |
| CCO Mobilidade / API | — | — | ❌ não há API pública conhecida | Pedido LAI |
| Pedido LAI | — | — | — | Rascunho em `LAI_NitTrans.md` |

## 1. ArcGIS REST — geo.niteroi.rj.gov.br

- Raiz: https://geo.niteroi.rj.gov.br/arcgis/rest/services/
- Pastas: Aplicacoes, campo, Censo_2010, civitas, dadosabertos, Galileo, geoprocessing, homolog, Imagens, Utilities.
- Os nomes das 247 camadas de 13 serviços (pastas `dadosabertos` e `Aplicacoes`) foram filtrados pelos termos semáforo, sinal, trânsito, viário, cruzamento, sentido e tráfego. **Nenhuma camada de semáforos.**
- Camadas úteis:
  - `dadosabertos/SMARHS_SMDCG_SMS_SMU/MapServer/150` **Logradouro** (polyline). Campos: ST_TYPE, ST_NO, CLASS, PAVEMENT, NO_POP, NO_ANT, Legislacao… **Sem campo de sentido da via.**
  - `dadosabertos/SMARHS_SMDCG_SMS_SMU/MapServer/170` **Eixo de estruturação viária** (polyline, com hierarquia viária).
- A consulta `returnCountOnly` na camada 150 deu timeout (servidor lento).

## 2. Site da NitTrans

- Página: https://nittrans.niteroi.rj.gov.br/semaforos/
- **Mapa "Elementos do Trânsito — Semáforos"**, código NITTRANS-DGM-INF-SINAL-MUN-2025V1, de 27/11/2025, feito pelo Departamento de Gestão e Modernização.
  - Cópia local: `data/raw/nittrans_mapa_semaforos_2025-11-27.png`
  - Mostra cerca de 350 semáforos. Há concentração em Centro, Icaraí, Santa Rosa, Fonseca e na Região Oceânica (Estrada Francisco da Cruz Nunes, Av. Central de Itaipu).
  - Foi gerado a partir de dados geográficos, então existe uma base georreferenciada interna, que é pedida no item 1 da LAI.
- A página diz que a lista de cruzamentos "Não há até a atual data".
- Também há um mapa de câmeras de contagem: https://nittrans.niteroi.rj.gov.br/wp-content/uploads/2025/12/CAMERAS-DE-CONTAGEM-NITTRANS-DGM-INF-SINAL-MUN-2025V1-PNG-1-scaled.png

## 3. Controladores / CCO

- 2016: a ENGIE venceu a licitação do CCO; o contrato foi de R$ 19,1 mi, financiado pelo BID. Previa **190 controladores inteligentes** (50 autônomos), ligados por fibra óptica.
  - Primeiro cruzamento: Av. Jansen de Mello × R. Marechal Deodoro (Centro).
  - Bairros: Centro, Icaraí, Fonseca, Ingá, Santa Rosa, São Francisco, Charitas, Largo da Batalha, Barreto, Engenho do Mato, Região Oceânica.
  - São **adaptativos**: câmeras analisam cada aproximação, e o sinal fecha "se durante três segundos nenhum carro passar".
  - Fontes: http://axelgrael.blogspot.com/2016/09/niteroi-cidade-inteligente-primeiro.html e https://www.guiadeniteroi.com/niteroi-ganhara-sinais-inteligentes-e-transito-monitorado/
- O CCO tem 190 câmeras em semáforos e 22 câmeras dome, e ajusta os tempos por corredor.
- **Maestro:** nenhuma referência pública encontrada ligando esse software a Niterói. Não confirmado.
- **Dataprom / CROSS RS4:** vieram da conversa anterior e ainda não foram confirmados nesta pesquisa.

### Implicação

Os semáforos adaptativos não têm ciclo fixo, então a estimativa por ciclo + offset é ruim neles (tipo `ADAPTIVE` na spec). No MVP, priorizar semáforos de **tempo fixo** e confirmar no local cronometrando vários ciclos.

## 4. 99 Motorista

- Parceria em Porto Alegre: a 99 manda dados de GPS dos motoristas para a prefeitura otimizar os tempos dos semáforos (1.300 semáforos).
  https://www.gazetadopovo.com.br/economia/cidade-brasileira-usa-dados-de-motoristas-de-aplicativo-para-sincronizar-semaforos/
- Não foi encontrada a origem da contagem regressiva mostrada no app. Hipóteses não verificadas: aprendizado a partir da frota (paradas e arrancadas dos motoristas) ou convênio com a prefeitura.

## 5. OpenStreetMap

- Ideia: contar os nós `highway=traffic_signals` na bbox de Niterói e ver se têm `traffic_signals:direction`.
- 2026-10-03: overpass-api.de, kumi.systems e private.coffee deram timeout ou 504. Tentar de novo ou usar extrato Geofabrik (sudeste do Brasil) filtrado localmente.

## Pendências

- [ ] Contagem de semáforos no OSM
- [x] Pedido LAI enviado em 2026-10-03 — protocolo 00000.000535/2026-28, prazo 2026-10-23 (prorrogável até 2026-11-02)
- [ ] Procurar editais/contratos (ENGIE 2016, manutenção semafórica) no portal de transparência para identificar marca/modelo dos controladores
- [ ] Escolher 5–10 semáforos para o MVP (preferir tempo fixo)
