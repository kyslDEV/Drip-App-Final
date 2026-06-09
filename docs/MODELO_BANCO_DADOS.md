# DripTest - Modelo Robusto de Banco de Dados

Documentos relacionados:

- `docs/ANALISE_REQUISITOS.md`
- `docs/ALGORITMO_DRIPTEST.md`
- `docs/AVALIACAO_SISTEMA.md`
- `docs/INTEGRACAO_WEB_BANCO.md`
- `backend-python/README.md`
- `database/schema.sql`

## 1. Objetivo

Este documento define um modelo robusto inicial de banco de dados para o DripTest.

O objetivo e migrar gradualmente do armazenamento local (`localStorage`) para uma base relacional, mantendo o fluxo atual do app:

- cadastro do monitor, lote e data de fabricacao;
- pesagem inicial;
- agenda de analise;
- pesagem final;
- emissao de laudos;
- auditoria basica.

Banco recomendado: **PostgreSQL**.

## 2. Visao geral das tabelas

Modelo robusto:

```text
plants
users
app_clients
production_lots
weighings
absorption_tests
technical_reports
technical_report_weighings
sync_batches
audit_logs
```

Tipos auxiliares no PostgreSQL:

```text
user_role
lot_status
weighing_status
report_status
sync_status
```

Views principais:

```text
v_weighing_report_data
v_lot_summary
```

## 2.1 Relacoes principais

```text
plants 1--N users
plants 1--N app_clients
plants 1--N production_lots
users 1--N app_clients
production_lots 1--N weighings
production_lots 1--N absorption_tests
production_lots 1--N technical_reports
weighings 1--N absorption_tests
technical_reports N--N weighings via technical_report_weighings
app_clients 1--N sync_batches
```

## 2.2 Por que `weighings` concentra inicial e final

O app atual trabalha com um mesmo registro evoluindo de `Inicial` para `final`.

Por isso, a tabela `weighings` guarda:

```text
dados iniciais obrigatorios
dados finais opcionais
status do registro
IDs locais do app para sincronizacao
```

## 3. Tabelas

### 3.1 `plants`

Representa uma unidade, planta, setor ou local de producao.

Campos principais:

- `id`
- `name`
- `code`
- `is_active`
- `created_at`

No inicio, pode existir apenas uma planta padrao.

### 3.2 `users`

Representa monitores, supervisores e administradores.

Campos principais:

- `id`
- `plant_id`
- `name`
- `email`
- `role`
- `password_hash`
- `is_active`
- `created_at`

Roles sugeridas:

- `monitor`
- `supervisor`
- `admin`

Na primeira versao, o campo `password_hash` pode ficar preparado para autenticacao futura.

### 3.3 `app_clients`

Representa uma instalacao do app Web/PWA ou app mobile.

Campos principais:

- `id`
- `plant_id`
- `user_id`
- `client_key`
- `platform`
- `app_version`
- `last_seen_at`
- `created_at`

Essa tabela permite sincronizacao entre Web, Android/Kotlin e backend.

### 3.4 `production_lots`

Representa o lote analisado.

Campos principais:

- `id`
- `plant_id`
- `lot_code`
- `fabrication_date`
- `product_brand`
- `species`
- `created_by`
- `created_at`

Observacao importante:

- especie deve continuar com linguagem como `Frango Friato` e `Frango Nutriza`;
- marca do produto nos laudos deve usar `Ave Friato` e `Ave Nutriza`.

### 3.5 `weighings`

Representa a pesagem da amostra. Para simplificar, a pesagem inicial e final ficam na mesma tabela.

Campos de identificacao:

- `id`
- `lot_id`
- `monitor_id`
- `sample_number`
- `species`
- `product_brand`
- `status`

Campos de pesagem inicial:

- `initial_gross_g`
- `initial_package_kg`
- `initial_package_g`
- `initial_net_g`
- `time_min`
- `time_interpolated`
- `initial_weighed_at`

Campos de pesagem final:

- `final_gross_g`
- `final_package_kg`
- `final_package_g`
- `final_net_g`
- `loss_abs_g`
- `loss_pct`
- `final_weighed_at`

Campos auxiliares:

- `client_record_id`
- `client_id`
- `sync_status`
- `source_app`
- `notes`
- `created_at`
- `updated_at`

Status sugeridos:

- `initial`
- `final`
- `reopened`
- `cancelled`

### 3.6 `absorption_tests`

Representa testes complementares de absorcao.

Campos principais:

- `id`
- `client_record_id`
- `lot_id`
- `weighing_id`
- `species`
- `product_brand`
- `base_type`
- `initial_weight_g`
- `final_weight_g`
- `dry_weight_g`
- `absorption_g`
- `absorption_pct`
- `note`
- `tested_at`

### 3.7 `technical_reports`

Representa o laudo emitido.

Campos principais:

- `id`
- `lot_id`
- `report_number`
- `status`
- `objective`
- `method`
- `conclusion`
- `report_json`
- `sha256_hash`
- `issued_by`
- `issued_at`
- `created_at`
- `updated_at`

Status sugeridos:

- `draft`
- `issued`
- `cancelled`

O campo `report_json` guarda um retrato completo do laudo no momento da emissao. Isso evita que alteracoes futuras nos registros mudem um laudo ja emitido.

### 3.8 `technical_report_weighings`

Relaciona um laudo aos registros usados nele e guarda snapshot por item.

Campos principais:

- `report_id`
- `weighing_id`
- `snapshot_json`

### 3.9 `sync_batches`

Registra tentativas de sincronizacao entre app e API.

Campos principais:

- `id`
- `client_id`
- `user_id`
- `direction`
- `status`
- `payload_json`
- `error_message`
- `started_at`
- `finished_at`

### 3.10 `audit_logs`

Representa uma trilha basica de auditoria.

Campos principais:

- `id`
- `user_id`
- `client_id`
- `entity_name`
- `entity_id`
- `action`
- `old_data`
- `new_data`
- `created_at`

Acoes sugeridas:

- `create`
- `update`
- `finalize`
- `reopen`
- `delete`
- `issue_report`
- `cancel_report`

## 4. Mapeamento do app atual para o banco

### Store local atual

```text
driptest_store_v2.initialRecords -> weighings
driptest_store_v2.absorptionTests -> absorption_tests
drip_user.monitorName -> users.name
drip_user.lot -> production_lots.lot_code
drip_user.fabDate -> production_lots.fabrication_date
laudo gerado -> technical_reports
```

### Campos de pesagem

| App atual | Banco |
| --- | --- |
| `id` | `weighings.client_record_id` |
| `species` | `weighings.species` |
| `productBrand` | `weighings.product_brand` |
| `lote` | `production_lots.lot_code` |
| `monitor` | `users.name` |
| `fabDate` | `production_lots.fabrication_date` |
| `gross` | `weighings.initial_gross_g` |
| `packKg` | `weighings.initial_package_kg` |
| `packGrams` | `weighings.initial_package_g` |
| `net` | `weighings.initial_net_g` |
| `timeMin` | `weighings.time_min` |
| `interpolated` | `weighings.time_interpolated` |
| `status` | `weighings.status` |
| `createdAt` | `weighings.initial_weighed_at` |
| `finalGross` | `weighings.final_gross_g` |
| `finalNet` | `weighings.final_net_g` |
| `finalPackKg` | `weighings.final_package_kg` |
| `finalPackGrams` | `weighings.final_package_g` |
| `lossAbs` | `weighings.loss_abs_g` |
| `lossPct` | `weighings.loss_pct` |
| `finalAt` | `weighings.final_weighed_at` |

## 4.1 Campos especificos de sincronizacao

| Campo | Uso |
| --- | --- |
| `client_record_id` | Guarda o ID gerado pelo Web/Kotlin antes de chegar ao servidor. |
| `client_id` | Identifica a instalacao do app. |
| `sync_status` | Marca `pending`, `synced`, `conflict` ou `error`. |
| `source_app` | Indica origem, como `web`, `pwa`, `android_webview` ou `kotlin`. |
| `sync_batches` | Guarda historico de envio/recebimento. |

## 5. Regras que o banco deve ajudar a proteger

### 5.1 Pesagem inicial obrigatoria

Uma pesagem precisa ter:

- lote;
- monitor;
- especie;
- marca;
- peso bruto inicial;
- peso liquido inicial;
- data/hora da pesagem inicial.

### 5.2 Pesagem final opcional

Campos finais podem ser nulos enquanto a amostra estiver pendente.

Quando `status = final`, deve existir:

- `final_net_g`;
- `loss_abs_g`;
- `final_weighed_at`.

### 5.3 Laudo preservado

Laudos emitidos devem guardar:

- JSON completo;
- hash SHA-256;
- usuario emissor;
- data de emissao.

## 6. Modelo minimo para primeira API

Rotas sugeridas:

```text
POST /auth/login
GET  /me

GET  /lots
POST /lots
GET  /lots/{id}

GET  /weighings?lot_id=...
POST /weighings
PATCH /weighings/{id}/finalize
PATCH /weighings/{id}/reopen

GET  /reports?lot_id=...
POST /reports
GET  /reports/{id}
```

## 7. Etapas de implementacao

1. Criar banco PostgreSQL.
2. Rodar `database/schema.sql`.
3. Evoluir o backend FastAPI criado em `backend-python`.
4. Completar endpoints de lotes, pesagens, finalizacao e laudos.
5. Adaptar o app Web para enviar dados ao backend.
6. Adicionar emissao de laudo no backend.
7. Adicionar auditoria.
8. Planejar sincronizacao com app Kotlin/Room.

## 8. Decisoes pendentes

- Confirmar regra final de perda/absorcao.
- Definir se o lote sempre tem uma unica marca/especie ou se pode misturar amostras.
- Definir numeracao oficial dos laudos.
- Definir perfis de usuario.
- Definir apenas se futuramente o app mobile tera sincronizacao propria com a API.
