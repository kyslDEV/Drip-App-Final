# Planilha de 3 Analises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a planilha de analise exibir ate 3 analises independentes por folha, criando nova folha automaticamente a partir da 4a analise, sem mexer no laudo atual.

**Architecture:** A logica de agrupamento e empacotamento sai da tela de relatorios e passa para `drip-data.js`, onde ja vivem as regras compartilhadas de consolidacao. `DripReports.html` passa a consumir uma estrutura pronta de folhas e apenas renderiza o HTML da planilha.

**Tech Stack:** HTML inline, JavaScript browser-first, localStorage, Node REPL para teste de comportamento sem dependencia de `node` no PATH.

---

### Task 1: Cobrir o agrupamento sequencial com teste

**Files:**
- Create: `tests/drip-data.analysis-sheet.test.js`
- Modify: `drip-data.js`

- [ ] **Step 1: Write the failing test**

Criar um teste com 4 grupos finalizados de analise para exigir 2 folhas: a primeira com 3 analises e a segunda com 1.

- [ ] **Step 2: Run test to verify it fails**

Run via `node_repl`: importar `tests/drip-data.analysis-sheet.test.js`.
Expected: FAIL because `DripData.buildAnalysisSheetData` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Adicionar em `drip-data.js`:
- agrupamento por contexto da analise;
- ordenacao estavel das amostras;
- empacotamento de blocos em folhas de ate 3 analises;
- exposicao publica de `buildAnalysisSheetData`.

- [ ] **Step 4: Run test to verify it passes**

Run via `node_repl`: importar `tests/drip-data.analysis-sheet.test.js`.
Expected: PASS with 2 folhas e contagem correta por folha.

- [ ] **Step 5: Commit**

```bash
git add tests/drip-data.analysis-sheet.test.js drip-data.js
git commit -m "feat: agrupa planilha em folhas de tres analises"
```

### Task 2: Atualizar a renderizacao da planilha na tela de relatorios

**Files:**
- Modify: `DripReports.html`
- Modify: `android-offline/app/src/main/assets/www/DripReports.html`

- [ ] **Step 1: Write the failing expectation mentally against current behavior**

A tela hoje gera um bloco por pagina e nao monta folhas com 3 analises.

- [ ] **Step 2: Implement the rendering change**

Consumir `DripData.buildAnalysisSheetData(report)` e renderizar:
- um cabecalho por folha;
- ate 3 blocos de analise por folha;
- placeholders visuais para slots vazios quando houver 1 ou 2 analises na folha.

- [ ] **Step 3: Re-run targeted verification**

Verificar geracao do HTML e conferir se a saida contem os marcadores de `Analise 1`, `Analise 2` e `Analise 3` conforme a quantidade de blocos.

- [ ] **Step 4: Commit**

```bash
git add DripReports.html android-offline/app/src/main/assets/www/DripReports.html
git commit -m "feat: renderiza planilha sequencial de tres analises"
```

### Task 3: Sincronizar assets e verificar

**Files:**
- Modify: `android-offline/app/src/main/assets/www/drip-data.js`
- Modify: `android-offline/app/src/main/assets/www/DripReports.html`

- [ ] **Step 1: Sync Android assets**

Run: `powershell -ExecutionPolicy Bypass -File .\android-offline\sync-web-assets.ps1`

- [ ] **Step 2: Verify syntax and behavior**

Run:
- importar o teste em `node_repl`
- validar sintaxe de `DripReports.html` e `drip-data.js` pelo mesmo harness

Expected: PASS sem erro de sintaxe nem assertion.

- [ ] **Step 3: Commit**

```bash
git add android-offline/app/src/main/assets/www/drip-data.js android-offline/app/src/main/assets/www/DripReports.html
git commit -m "chore: sincroniza assets android da planilha"
```
