# DripTest - Arquitetura do Sistema

Documentos relacionados:

- `docs/ANALISE_REQUISITOS.md`
- `docs/INTEGRACAO_WEB_BANCO.md`
- `docs/MODELO_BANCO_DADOS.md`
- `backend-python/README.md`
- `database/schema.sql`

## 1. Objetivo

Este documento descreve a arquitetura atual do DripTest como sistema operacional de coleta, calculo, consolidacao e emissao de laudos tecnicos de analise de drip.

O sistema foi desenhado para operar em modo local/offline, com integracao incremental a um backend FastAPI e persistencia central em PostgreSQL, sem quebrar o fluxo de uso no chao de fabrica.

## 2. Visao geral

O DripTest hoje e composto por tres camadas principais:

1. frontend Web/PWA para operacao local e uso em navegador;
2. backend FastAPI para autenticacao, sincronizacao e persistencia oficial;
3. aplicativo Android com WebView que empacota a mesma aplicacao web para uso em APK.

Arquitetura logica:

```text
Operador / Supervisor
        |
        v
Web App DripTest (HTML + JS + localStorage + PWA)
        |
        | drip-api.js / drip-sync.js
        v
FastAPI Backend Python
        |
        v
PostgreSQL
```

Arquitetura de distribuicao:

```text
Navegador desktop/mobile ------> arquivos web do projeto
                                  |-- localStorage
                                  |-- service-worker
                                  |-- manifest.webmanifest

APK Android (WebView) ---------> android-offline/app/src/main/assets/www
                                  |-- mesma base HTML/CSS/JS sincronizada

Backend API -------------------> backend-python/app
Banco relacional --------------> PostgreSQL via database/schema.sql
```

## 3. Principios arquiteturais

### 3.1 Offline-first

O fluxo operacional principal nao depende do backend para funcionar.

Os dados de trabalho continuam sendo gravados localmente para garantir uso mesmo quando houver:

- falta de rede;
- indisponibilidade da API;
- operacao em dispositivos isolados;
- uso dentro do WebView Android.

### 3.2 Integracao incremental

O backend foi acoplado sem substituir de uma vez o armazenamento local.

Na pratica:

- a coleta operacional continua local;
- a sincronizacao envia snapshots e registros para a API quando configurada;
- o banco passa a ser a fonte oficial para historico, auditoria e laudos emitidos.

### 3.3 Regra de negocio centralizada no frontend

As regras de calculo e normalizacao usadas pelas telas devem ficar centralizadas em `drip-data.js`, evitando divergencia entre:

- pesagem inicial;
- pesagem final;
- cronograma;
- relatorios;
- exportacao/importacao.

## 4. Camadas do sistema

### 4.1 Frontend Web/PWA

O frontend e formado por paginas HTML especializadas, apoiadas por scripts compartilhados.

Arquivos principais:

- `index.html`: tela inicial e distribuicao de perfis/entrada.
- `login.html`: captura dados operacionais da sessao, como monitor, lote, setor e data de fabricacao.
- `DripTeste.html`: registro da pesagem inicial.
- `DripSchedule.html`: cronograma e previsao dos tempos de analise.
- `DripTestF.html`: registro da pesagem final.
- `DripReports.html`: consolidacao, historico, relatorios e emissao de laudos.
- `DripAbsorption.html`: testes complementares de absorcao.
- `drip-data.js`: camada central de dados, normalizacao, calculos e consolidacao.
- `drip-api.js`: cliente HTTP e gestao de configuracao/sessao da API.
- `drip-sync.js`: montagem do snapshot local e envio para sincronizacao.
- `drip-ui.js`: comportamento visual compartilhado.
- `service-worker.js`: cache de recursos do PWA.
- `manifest.webmanifest`: metadados de instalacao.

Responsabilidades do frontend:

- capturar dados operacionais;
- calcular pesos, tempos e indicadores;
- manter o store local;
- gerar visoes de relatorio;
- exportar/importar dados;
- sincronizar com o backend quando habilitado.

### 4.2 Camada de dados local

O frontend usa `localStorage` como persistencia primaria de operacao.

Chaves principais:

- `driptest_store_v2`: store principal com pesagens e testes de absorcao;
- `drip_user`: sessao operacional local com monitor, lote, setor/planta e fabricacao;
- `driptest_api_config`: configuracao da API;
- `driptest_auth_session`: sessao autenticada da API;
- `driptest_pesagem_inicial_v1`: compatibilidade com legado.

Estrutura funcional:

- `initialRecords`: registros de pesagem inicial/final;
- `absorptionTests`: testes complementares;
- `updatedAt`: marcador local de atualizacao.

### 4.3 Backend FastAPI

O backend implementa a camada de servico e persistencia oficial.

Arquivos principais:

- `backend-python/app/main.py`: endpoints e bootstrap da aplicacao;
- `backend-python/app/repositories.py`: operacoes de acesso a dados e regras de persistencia;
- `backend-python/app/schemas.py`: contratos de entrada e saida;
- `backend-python/app/database.py`: pool e conexao PostgreSQL;
- `backend-python/app/security.py`: autenticacao por token tecnico e sessao de usuario;
- `backend-python/app/settings.py`: configuracao por ambiente.

Responsabilidades do backend:

- validar disponibilidade da API;
- autenticar usuarios;
- receber snapshots do frontend;
- persistir lotes, pesagens, testes e laudos;
- reabrir/finalizar registros;
- consolidar historico oficial para consulta.

Endpoints atuais:

```text
GET  /health

POST /auth/login
GET  /me

POST /sync/push
GET  /sync/pull

GET  /lots
POST /lots
GET  /lots/{lot_id}

GET  /weighings
POST /weighings
PATCH /weighings/{id}/finalize
PATCH /weighings/{id}/reopen

GET  /reports
POST /reports
GET  /reports/{report_id}
```

### 4.4 Banco PostgreSQL

O PostgreSQL e a base relacional oficial do sistema.

Tabelas e estruturas principais:

- `plants`
- `users`
- `app_clients`
- `production_lots`
- `weighings`
- `absorption_tests`
- `technical_reports`
- `technical_report_weighings`
- `sync_batches`
- `audit_logs`
- `v_weighing_report_data`
- `v_lot_summary`

Papel do banco:

- consolidar o historico oficial;
- permitir rastreabilidade por lote, monitor e planta;
- sustentar laudos tecnicos oficiais;
- registrar sincronizacao e auditoria.

### 4.5 Android WebView

O projeto `android-offline/` gera um APK nativo que embute a aplicacao web.

Arquivos principais:

- `android-offline/app/src/main/java/com/driptest/offline/MainActivity.java`
- `android-offline/app/src/main/java/com/driptest/offline/DripNotificationReceiver.java`
- `android-offline/app/src/main/assets/www/*`
- `android-offline/sync-web-assets.ps1`

Papel da camada Android:

- empacotar a interface web em um APK;
- habilitar uso com `WebView`, `localStorage` e acesso a arquivos locais;
- acionar intents externas para links HTTP/HTTPS, WhatsApp e marketplace;
- suportar recursos nativos como notificacoes e compartilhamento de PDF.

Observacao importante:

- o `MainActivity` atual abre `file:///android_asset/www/index.html`;
- os arquivos publicados dentro do APK precisam ser sincronizados a partir da raiz web com `android-offline/sync-web-assets.ps1`.

## 5. Fluxos principais

### 5.1 Fluxo operacional offline

```text
Operador
  -> login.html define dados da sessao
  -> DripTeste.html registra pesagem inicial
  -> DripSchedule.html calcula agenda
  -> DripTestF.html registra pesagem final
  -> DripReports.html consolida resultados
  -> localStorage guarda os dados localmente
```

Esse fluxo continua funcionando mesmo sem API configurada.

### 5.2 Fluxo de sincronizacao

```text
Frontend local
  -> drip-sync.js monta snapshot
  -> drip-api.js envia POST /sync/push
  -> FastAPI converte e persiste no PostgreSQL
  -> API retorna resultado de importacao
```

O snapshot contem:

- metadados do app;
- sessao do usuario local;
- store com pesagens e testes;
- laudo consolidado opcional.

### 5.3 Fluxo de laudo oficial

```text
DripReports.html
  -> sincroniza dados locais
  -> identifica lote(s) tecnico(s)
  -> chama POST /reports
  -> backend grava technical_reports
  -> backend vincula pesagens em technical_report_weighings
```

Esse fluxo separa:

- previa local do relatorio;
- sincronizacao do store;
- emissao oficial do laudo no banco.

### 5.4 Fluxo Android

```text
APK Android
  -> WebView carrega index.html dos assets
  -> telas web usam os mesmos scripts do frontend
  -> dados ficam no storage do WebView
  -> API pode ser chamada via HTTP/HTTPS quando configurada
  -> recursos nativos complementam PDF, compartilhamento e notificacoes
```

## 6. Componentes de integracao

### 6.1 `drip-data.js`

E a principal camada de dominio no frontend.

Responsabilidades:

- criar e normalizar registros;
- centralizar regras de calculo;
- calcular tempo por faixa/interpolacao;
- calcular perda/absorcao;
- classificar indicadores de mercado;
- consolidar dados para relatorios;
- manter compatibilidade com dados legados.

### 6.2 `drip-api.js`

E a camada cliente de comunicacao com a API.

Responsabilidades:

- salvar configuracao da API;
- salvar sessao autenticada;
- montar headers HTTP;
- anexar token tecnico ou sessao humana;
- expor funcoes de consumo dos endpoints.

### 6.3 `drip-sync.js`

E a camada de sincronizacao do estado local.

Responsabilidades:

- ler o store local;
- montar snapshot consistente;
- incluir relatorio quando necessario;
- enviar para a API sem acoplar a operacao das telas ao backend.

## 7. Autenticacao e seguranca

O backend suporta dois modelos de autenticacao:

- token tecnico via `Authorization: Bearer <DRIP_API_TOKEN>`;
- sessao de usuario emitida por `POST /auth/login`.

Finalidade de cada modo:

- token tecnico: integracoes de servico, sincronizacao e chamadas tecnicas;
- sessao humana: operacao auditavel por usuario.

Pontos de atencao:

- o frontend continua apto a operar sem login remoto;
- CORS deve ser configurado no backend para as origens reais;
- o Android nao deve apontar para `127.0.0.1` quando a API estiver em outra maquina.

## 8. Persistencia e consistencia

O sistema trabalha hoje com dupla persistencia controlada:

- persistencia local para continuidade operacional;
- persistencia oficial no banco para rastreabilidade e historico.

Consequencias arquiteturais:

- o backend nao pode ser requisito para a coleta local;
- falha de sincronizacao nao deve apagar dados do operador;
- consolidacao de laudo oficial deve ocorrer no servidor para reduzir divergencia;
- o frontend precisa continuar tolerante a indisponibilidade da API.

## 9. Implantacao e ambientes

### 9.1 Frontend Web

Pode ser publicado como site estatico/PWA.

Artefatos relevantes:

- paginas HTML;
- scripts JS compartilhados;
- `service-worker.js`;
- `manifest.webmanifest`;
- `icons/`.

### 9.2 Backend

Executa como aplicacao Python com FastAPI e conexao PostgreSQL.

Configuracoes centrais por ambiente:

- `DRIP_DATABASE_URL`
- `DRIP_API_TOKEN`
- `DRIP_CORS_ORIGINS`
- `DRIP_AUTH_TOKEN_TTL_HOURS`
- `DRIP_BOOTSTRAP_ADMIN_NAME`
- `DRIP_BOOTSTRAP_ADMIN_EMAIL`
- `DRIP_BOOTSTRAP_ADMIN_PASSWORD`

### 9.3 Android

O APK precisa ser regenerado sempre que os assets web forem alterados e sincronizados.

Processo resumido:

1. alterar arquivos web na raiz do projeto;
2. rodar `android-offline/sync-web-assets.ps1`;
3. gerar novo APK em `android-offline/`.

## 10. Decisoes arquiteturais atuais

As decisoes mais importantes da arquitetura atual sao:

- manter o frontend operacional de forma autonoma;
- usar `drip-data.js` como fonte central das regras de negocio do frontend;
- tratar o backend como camada oficial de persistencia, historico e laudos;
- reaproveitar o mesmo frontend tanto no navegador quanto no APK Android;
- adotar PostgreSQL como base relacional central;
- preservar integracao incremental para evitar ruptura no processo operacional.

## 11. Riscos e pontos de controle

Pontos que exigem disciplina operacional e tecnica:

- manter sincronizados os assets da raiz web e do APK;
- evitar duplicacao de regra de negocio fora de `drip-data.js`;
- garantir que laudo local e laudo oficial usem a mesma base de dados consolidada;
- configurar corretamente a URL da API em dispositivos Android;
- validar CORS, token tecnico e credenciais antes de uso em producao.

## 12. Resumo executivo

O DripTest e um sistema hibrido de operacao local com sincronizacao central.

Sua arquitetura atual combina:

- frontend Web/PWA orientado a continuidade operacional;
- backend FastAPI para servicos e persistencia oficial;
- banco PostgreSQL para historico, rastreabilidade e laudos;
- empacotamento Android via WebView para uso movel com a mesma base web.

Essa arquitetura permite evolucao gradual para um ambiente mais controlado sem perder a robustez do fluxo offline que sustenta a operacao no dia a dia.
