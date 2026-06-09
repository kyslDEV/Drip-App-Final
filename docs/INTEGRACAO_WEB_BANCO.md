# DripTest - Integracao Web, API e Banco de Dados

Documentos relacionados:

- `docs/MODELO_BANCO_DADOS.md`
- `docs/GESTAO_DADOS_LAUDOS_E_BANCO.md`
- `database/schema.sql`
- `backend-python/README.md`
- `drip-api.js`
- `drip-sync.js`

## 1. Objetivo

Este documento define como o app Web atual deve evoluir para funcionar integrado a um backend e ao banco PostgreSQL.

A estrategia e incremental:

1. manter o app funcionando localmente;
2. adicionar camada de API sem quebrar a operacao atual;
3. enviar snapshots para o backend;
4. depois substituir partes do `localStorage` por sincronizacao real;
5. preparar o mesmo contrato para o app Kotlin/Room.

## 2. Arquitetura alvo

```text
Web/PWA DripTest
  |
  | drip-api.js / drip-sync.js
  v
FastAPI Backend Python
  |
  | psycopg agora; Alembic/migrations depois
  v
PostgreSQL
```

Futuro app mobile:

```text
Kotlin Android
  |
  | Room local + WorkManager
  v
FastAPI Backend
  |
  v
PostgreSQL
```

## 3. Camada Web criada

### `drip-api.js`

Responsavel por:

- guardar configuracao da API em `localStorage`;
- guardar sessao autenticada quando houver login por usuario;
- fazer requests HTTP;
- enviar token de servico ou token de sessao quando existir;
- expor funcoes:
  - `DripApi.getConfig()`
  - `DripApi.setConfig(config)`
  - `DripApi.getSession()`
  - `DripApi.setSession(session)`
  - `DripApi.isEnabled()`
  - `DripApi.getHealth()`
  - `DripApi.login(identifier, password)`
  - `DripApi.getMe()`
  - `DripApi.createLot(payload)`
  - `DripApi.createWeighing(payload)`
  - `DripApi.listLots(limit)`
  - `DripApi.listReports(limit)`
  - `DripApi.getReport(reportId)`
  - `DripApi.createReport(payload)`
  - `DripApi.pushSnapshot(snapshot)`
  - `DripApi.pullSince(since)`

Chave local:

```text
driptest_api_config
```

Formato:

```json
{
  "baseUrl": "https://api.exemplo.com",
  "token": "jwt",
  "enabled": true
}
```

### `drip-sync.js`

Responsavel por:

- montar um snapshot do store local;
- incluir usuario/lote/fabricacao;
- incluir ou nao o laudo consolidado, conforme a chamada;
- enviar para API quando estiver configurada.

Funcoes:

```text
DripSync.buildLocalSnapshot(options)
DripSync.pushLocalStore(options)
```

Comportamento atual:

- `DripSync.pushLocalStore()` sincroniza pesagens e testes sem emitir laudo;
- `DripSync.pushLocalStore({ includeReport: true })` inclui o snapshot local do laudo quando esse envio for necessario.

## 3.1 Estado atual do frontend

Situacao verificada em `2026-05-24`:

- `login.html`: continua local, gravando `drip_user` para identificar monitor, setor, lote e data de fabricacao.
- `DripTeste.html`: agora esta em modo hibrido. Continua preservando tudo no `localStorage`, mas tambem envia novas pesagens para `POST /weighings` quando a API estiver configurada.
- `DripTestF.html`: ainda opera a partir de `DripData.getInitialRecords()` e `DripData.saveInitialRecords()`.
- `DripSchedule.html`: ainda usa o store local como fonte principal da agenda e dos tempos previstos.
- `DripReports.html`: continua montando a previa local, mas agora tambem sincroniza dados, emite laudo oficial em `POST /reports` e consulta o historico de laudos oficiais do backend.
- `drip-sync.js`: continua sendo o caminho de consolidacao por snapshot para enviar o estado local completo ao backend.

Observacoes importantes desta fase:

- a operacao nao para se a API falhar;
- a pesagem inicial ja passa a persistir no banco sem remover o fluxo offline;
- a emissao oficial de laudo foi separada da sincronizacao simples do store;
- o PDF tenta usar a emissao oficial do backend quando a API estiver ativa;
- exclusao remota de pesagens ainda nao existe, entao registros ja enviados nao devem ser removidos localmente.

## 4. Snapshot enviado pela Web

Formato inicial:

```json
{
  "app": "DripTest",
  "schemaVersion": 1,
  "generatedAt": "2026-05-22T00:00:00.000Z",
  "user": {
    "monitorName": "Ana",
    "fabDate": "2026-05-22",
    "lot": "006"
  },
  "store": {
    "version": 2,
    "initialRecords": [],
    "absorptionTests": []
  },
  "report": {}
}
```

O backend deve converter:

- `user.monitorName` para `users`;
- `user.lot` e `user.fabDate` para `production_lots`;
- `store.initialRecords` para `weighings`;
- `store.absorptionTests` para `absorption_tests`;
- `report` para `technical_reports` quando um laudo for emitido.

## 5. Endpoints recomendados

### Saude

```text
GET /health
```

Resposta:

```json
{
  "status": "ok"
}
```

### Sincronizar envio do app

```text
POST /sync/push
```

Entrada:

```json
{
  "app": "DripTest",
  "schemaVersion": 1,
  "generatedAt": "...",
  "user": {},
  "store": {},
  "report": {}
}
```

Resposta sugerida:

```json
{
  "ok": true,
  "syncBatchId": "uuid",
  "imported": {
    "lots": 1,
    "weighings": 6,
    "absorptionTests": 0
  },
  "conflicts": []
}
```

### Sincronizar retorno para o app

```text
GET /sync/pull?since=2026-05-22T00:00:00.000Z
```

Resposta sugerida:

```json
{
  "serverTime": "...",
  "lots": [],
  "weighings": [],
  "reports": []
}
```

### Autenticacao e operacao direta

Ja disponiveis no backend atual:

```text
POST /auth/login
GET /me
GET /lots
GET /lots/{lot_id}
POST /lots
GET /weighings
POST /weighings
PATCH /weighings/{id}/finalize
PATCH /weighings/{id}/reopen
GET /reports
POST /reports
GET /reports/{report_id}
```

Payload atual aceito para emissao de laudo:

```json
{
  "lot_id": "uuid-opcional",
  "lot_ids": ["uuid-1", "uuid-2"]
}
```

Regra:

- usar `lot_id` quando o laudo oficial corresponder a um unico lote tecnico;
- usar `lot_ids` quando a emissao oficial precisar consolidar mais de um lote tecnico no backend.

## 6. Mapeamento para PostgreSQL

### Monitor

```text
snapshot.user.monitorName -> users.name
```

Se ainda nao existir usuario real, o backend pode criar um usuario `monitor` com email nulo.

### Lote

```text
snapshot.user.lot -> production_lots.lot_code
snapshot.user.fabDate -> production_lots.fabrication_date
record.productBrand -> production_lots.product_brand
record.species -> production_lots.species
```

### Pesagem

```text
record.id -> weighings.client_record_id
record.gross -> weighings.initial_gross_g
record.packKg -> weighings.initial_package_kg
record.packGrams -> weighings.initial_package_g
record.net -> weighings.initial_net_g
record.timeMin -> weighings.time_min
record.interpolated -> weighings.time_interpolated
record.createdAt -> weighings.initial_weighed_at
record.finalGross -> weighings.final_gross_g
record.finalNet -> weighings.final_net_g
record.finalPackKg -> weighings.final_package_kg
record.finalPackGrams -> weighings.final_package_g
record.lossAbs -> weighings.loss_abs_g
record.lossPct -> weighings.loss_pct
record.finalAt -> weighings.final_weighed_at
```

## 7. Etapas para ativar integracao real

### Etapa 1 - Backend minimo

Criado em `backend-python` com:

```text
GET /health
POST /sync/push
GET /sync/pull
GET /lots
POST /lots
GET /weighings
POST /weighings
GET /reports
GET /reports/{report_id}
```

### Etapa 2 - Tela/configuracao de API

Adicionar no app uma tela administrativa para gravar:

```text
baseUrl
token
enabled
```

### Etapa 3 - Botao de sincronizacao

Adicionar acao manual:

```text
Sincronizar agora
```

Essa acao chama:

```text
DripSync.pushLocalStore()
```

### Etapa 4 - Migracao por telas

Ordem recomendada de migracao para banco central:

1. `DripTeste.html`
   - status: iniciado
   - objetivo: gravar novas pesagens em `POST /weighings` sem perder o store local
2. `DripTestF.html`
   - objetivo: finalizar usando `PATCH /weighings/{id}/finalize` e reabrir usando `PATCH /weighings/{id}/reopen`
3. `DripSchedule.html`
   - objetivo: ler agenda a partir de `GET /weighings` ou `GET /lots`, usando local como cache
4. `DripReports.html`
   - status: iniciado
   - objetivo: sincronizar dados locais, emitir laudo com `POST /reports`, consultar historico real com `GET /reports` e usar o retorno oficial no PDF
5. `login.html`
   - objetivo: evoluir de identificacao operacional para autenticacao real com `POST /auth/login`

### Etapa 5 - Sincronizacao automatica

Depois:

- sincronizar ao abrir;
- sincronizar apos salvar pesagem;
- sincronizar apos finalizar pesagem;
- sincronizar apos emitir laudo.

### Etapa 6 - Kotlin

O app Kotlin deve usar os mesmos conceitos:

- `client_record_id`;
- `client_id`;
- `sync_batches`;
- `sync_status`;
- `weighings`;
- `technical_reports`.

## 8. Cuidados

- O app Web nao deve depender da API para funcionar nesta fase.
- Se a API falhar, os dados locais continuam preservados.
- O backend deve tratar `client_record_id` como chave de idempotencia.
- O laudo emitido deve ser salvo como snapshot imutavel em `technical_reports.report_json`.
- A sincronizacao simples do store nao deve emitir laudo automaticamente.
- A emissao oficial deve preferir o retorno do backend para numero e hash do laudo.
- Conflitos devem ser registrados em `sync_batches` e resolvidos depois.
- Enquanto nao existir endpoint de exclusao, um registro sincronizado nao deve ser apagado da tela inicial.
