# Limpar Entradas da Pesagem Inicial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o botao `Limpar` da pesagem inicial resetar apenas os campos do formulario sem apagar os registros ja lancados.

**Architecture:** O ajuste fica concentrado em `DripTeste.html`, porque o comportamento incorreto esta no listener local do botao. O teste de regressao valida o bloco do listener para garantir que ele nao volte a zerar `records` nem chamar persistencia de exclusao.

**Tech Stack:** HTML inline, JavaScript browser-first, Node REPL para teste de regressao por leitura de source.

---

### Task 1: Cobrir o comportamento do botao Limpar

**Files:**
- Create: `tests/drip-initial-clear-button.test.js`
- Modify: `DripTeste.html`

- [ ] **Step 1: Write the failing test**

Escrever um teste que leia `DripTeste.html`, extraia o listener do `clearBtn` e exija:
- reset de `grossEl`, `packEl` e `speciesEl`
- foco em `grossEl`
- ausencia de `records = []`
- ausencia de `saveToStorage()`

- [ ] **Step 2: Run test to verify it fails**

Run via `node_repl`: importar `tests/drip-initial-clear-button.test.js`.
Expected: FAIL porque o listener atual apaga os registros.

- [ ] **Step 3: Write minimal implementation**

Modificar o listener do `clearBtn` em `DripTeste.html` para apenas resetar os campos do formulario.

- [ ] **Step 4: Run test to verify it passes**

Run via `node_repl`: importar `tests/drip-initial-clear-button.test.js`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/drip-initial-clear-button.test.js DripTeste.html
git commit -m "fix: limita limpar da pesagem inicial as entradas"
```

### Task 2: Sincronizar e verificar assets Android

**Files:**
- Modify: `android-offline/app/src/main/assets/www/DripTeste.html`

- [ ] **Step 1: Sync Android assets**

Run: `powershell -ExecutionPolicy Bypass -File .\android-offline\sync-web-assets.ps1`

- [ ] **Step 2: Verify**

Run no `node_repl`:
- importar `tests/drip-initial-clear-button.test.js`
- validar sintaxe do script inline de `DripTeste.html` com `vm.Script`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add android-offline/app/src/main/assets/www/DripTeste.html
git commit -m "chore: sincroniza assets android da pesagem inicial"
```
