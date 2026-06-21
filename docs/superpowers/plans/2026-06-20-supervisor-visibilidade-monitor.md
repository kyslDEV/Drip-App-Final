# Supervisor Visibilidade Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o supervisor enxergar automaticamente, pela API, as ações do monitor na análise sem liberar controles técnicos de API para o perfil supervisor.

**Architecture:** O backend continua sendo o hub compartilhado entre dispositivos. `DripTestF.html` completa o ciclo de escrita sincronizando finalização/reabertura, e `DripSupervisor.html` volta a ler a API em modo somente leitura, mesclando backend e base local para preservar continuidade offline.

**Tech Stack:** HTML com JavaScript inline, `drip-api.js`, FastAPI existente, testes textuais em Python e testes JS via Node.

---

### Task 1: Virar os testes para o comportamento aprovado

**Files:**
- Modify: `tests/drip-supervisor-ui-api-boundary.test.py`
- Create: `tests/drip-finalization-api-sync.test.py`

- [ ] **Step 1: Escrever a expectativa read-only do supervisor**

Validar em `tests/drip-supervisor-ui-api-boundary.test.py` que:
- `DripSupervisor.html` continua sem `DripSettings.html`
- continua sem botoes `syncLocalBtn`, `syncBankBtn`, `testApiBtn`
- volta a carregar `drip-api.js`
- volta a usar `mergeRecords(` e leitura da API em `loadData`

- [ ] **Step 2: Rodar o teste do supervisor para falhar**

Run: `python tests/drip-supervisor-ui-api-boundary.test.py`
Expected: FAIL porque a tela ainda esta em modo local puro.

- [ ] **Step 3: Escrever o teste da finalizacao**

Criar `tests/drip-finalization-api-sync.test.py` exigindo que `DripTestF.html`:
- chame `DripApi.finalizeWeighing(`
- chame `DripApi.reopenWeighing(`
- use `record.backendId` para sincronizar a etapa final

- [ ] **Step 4: Rodar o teste da finalizacao para falhar**

Run: `python tests/drip-finalization-api-sync.test.py`
Expected: FAIL porque o fluxo final ainda e local.

### Task 2: Implementar o ciclo completo Monitor -> API -> Supervisor

**Files:**
- Modify: `drip-api.js`
- Modify: `DripTestF.html`
- Modify: `DripSupervisor.html`

- [ ] **Step 1: Adicionar helpers de finalize/reopen na API**

Incluir em `drip-api.js`:
- `finalizeWeighing(weighingId, payload)`
- `reopenWeighing(weighingId)`

- [ ] **Step 2: Sincronizar finalizacao e reabertura**

Em `DripTestF.html`, apos salvar a alteracao local:
- quando `DripApi.isEnabled()` e `record.backendId` existirem, enviar `final_net_g`, embalagem final e horario final
- atualizar `syncStatus`, `syncedAt` e limpar `syncError`
- em falha, preservar a finalizacao local e registrar `syncError`

- [ ] **Step 3: Restaurar leitura automatica read-only do supervisor**

Em `DripSupervisor.html`:
- carregar `drip-api.js`
- consultar `DripApi.listWeighings(...)` apenas para leitura
- normalizar backend com `SupervisorData.normalizeServerRows(...)`
- mesclar com `SupervisorData.mergeRecords(...)`
- mostrar banner coerente para `Local`, `API` ou `Local + API`
- manter a tela sem controles tecnicos de gestao da API

### Task 3: Propagar para Android, validar e publicar

**Files:**
- Modify: `android-offline/app/src/main/assets/www/DripSupervisor.html`
- Modify: `android-offline/app/src/main/assets/www/DripTestF.html`
- Modify: `android-offline/app/src/main/assets/www/drip-api.js`

- [ ] **Step 1: Sincronizar assets web para Android**

Run: `powershell -ExecutionPolicy Bypass -File .\android-offline\sync-web-assets.ps1`

- [ ] **Step 2: Rodar verificacoes**

Run:
- `python tests/drip-supervisor-ui-api-boundary.test.py`
- `python tests/drip-finalization-api-sync.test.py`
- `node tests/drip-supervisor-data.test.js`

Expected: PASS.

- [ ] **Step 3: Publicar somente este escopo**

Criar branch `codex/supervisor-visibilidade-monitor`, stagear apenas arquivos deste pacote, commitar e enviar para `origin`.
