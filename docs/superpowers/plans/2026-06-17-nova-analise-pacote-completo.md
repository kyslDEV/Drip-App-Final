# Nova Analise Pacote Completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Salvar o pacote completo da analise ativa e iniciar novo lote pelo `login.html`.

**Architecture:** A persistencia do pacote fica em `drip-data.js`, junto da store local que ja guarda `initialRecords` e `absorptionTests`. `DripTeste.html` apenas dispara `DripData.archiveCurrentAnalysis(...)`, limpa `drip_user` e redireciona para `login.html`.

**Tech Stack:** HTML inline, JavaScript browser-first, localStorage, Node REPL para validacao de comportamento e sintaxe.

---

### Task 1: Persistencia do pacote completo

**Files:**
- Create: `tests/drip-data.archive-analysis.test.js`
- Modify: `drip-data.js`

- [ ] **Step 1: Write the failing test**

Criar teste que salve registros iniciais/finalizados e teste complementar, chame `archiveCurrentAnalysis`, e valide:
- arquivo criado em `archivedAnalyses`
- `initialRecords` ativo limpo
- `absorptionTests` ativo limpo
- `drip_user` nao e removido por `drip-data.js`
- pacote contem `user`, `initialRecords`, `absorptionTests` e `report`

- [ ] **Step 2: Run test to verify it fails**

Run via `node_repl`: importar `tests/drip-data.archive-analysis.test.js`.
Expected: FAIL porque `archiveCurrentAnalysis` ainda nao existe.

- [ ] **Step 3: Implement minimal data API**

Adicionar ao `drip-data.js`:
- `archivedAnalyses` no store normalizado
- `normalizeArchivedAnalysis`
- `getArchivedAnalyses`
- `archiveCurrentAnalysis`

- [ ] **Step 4: Run test to verify it passes**

Run via `node_repl`: importar `tests/drip-data.archive-analysis.test.js`.
Expected: PASS.

### Task 2: Botao Nova analise

**Files:**
- Modify: `DripTeste.html`
- Modify: `android-offline/app/src/main/assets/www/DripTeste.html`

- [ ] **Step 1: Add UI button**

Adicionar `button id="newAnalysisBtn"` nos controles da tela inicial.

- [ ] **Step 2: Wire behavior**

Ao clicar:
- exigir confirmacao quando houver registros ativos
- chamar `DripData.archiveCurrentAnalysis({ user: getUserConfig() })`
- cancelar lembretes dos registros ativos
- remover `drip_user`
- redirecionar para `login.html`

- [ ] **Step 3: Sync Android assets and verify**

Run:
- `powershell -ExecutionPolicy Bypass -File .\android-offline\sync-web-assets.ps1`
- teste de arquivamento no `node_repl`
- `vm.Script` no script inline de `DripTeste.html`

Expected: PASS.
