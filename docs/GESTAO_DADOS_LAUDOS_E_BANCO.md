# DripTest - Gestao de Dados, Laudos e Banco

Documentos relacionados:

- `docs/CAPACIDADES_ATUAIS_DRIPTEST.md`
- `docs/INTEGRACAO_WEB_BANCO.md`
- `docs/MODELO_BANCO_DADOS.md`
- `backend-python/README.md`
- `database/schema.sql`

## 1. Objetivo

Este documento consolida como os dados do DripTest nascem, circulam, sao consolidados em laudos e chegam ao banco central.

## 2. Fontes de dados atuais

### 2.1 Armazenamento local

Chaves principais:

- `drip_user`
- `driptest_store_v2`
- `driptest_pesagem_inicial_v1`
- `driptest_api_config`
- `driptest_auth_session`

Uso:

- `drip_user` guarda monitor, setor, lote e data de fabricacao;
- `driptest_store_v2` guarda pesagens e testes complementares;
- `driptest_pesagem_inicial_v1` continua existindo por compatibilidade;
- `driptest_api_config` guarda a configuracao de integracao com a API;
- `driptest_auth_session` guarda a sessao autenticada quando houver login real.

### 2.2 Banco central

Tabelas principais:

- `production_lots`
- `weighings`
- `absorption_tests`
- `technical_reports`
- `technical_report_weighings`
- `sync_batches`
- `audit_logs`

## 3. Como o dado nasce no app

Fluxo atual:

1. o usuario informa contexto operacional em `login.html`;
2. a pesagem inicial grava uma amostra em `driptest_store_v2`;
3. quando a API estiver ativa, a tela inicial tambem envia a nova pesagem para `POST /weighings`;
4. a pesagem final atualiza o mesmo registro local;
5. a tela de laudos consolida tudo em um snapshot tecnico;
6. esse snapshot pode gerar previa, CSV, PDF e laudo oficial no backend.

## 4. Sincronizacao de dados

`drip-sync.js` agora trabalha com dois modos:

- `DripSync.pushLocalStore()`
  - envia pesagens e testes sem emitir laudo;
- `DripSync.pushLocalStore({ includeReport: true })`
  - inclui tambem o snapshot local do laudo.

Objetivo desta separacao:

- evitar que uma sincronizacao comum gere laudos oficiais sem intencao;
- deixar a emissao oficial do laudo sob controle explicito da tela de relatorios.

## 5. Laudo local

O laudo local e montado pelo `DripData.buildReportData()`.

Ele consolida:

- rastreabilidade;
- metadados operacionais;
- totais e medias;
- resumo por lote;
- pesagens iniciais;
- pesagens finalizadas;
- testes complementares;
- conclusao automatica.

Saidas locais:

- previa textual;
- copia de texto;
- compartilhamento;
- CSV;
- PDF/impressao.

## 6. Emissao oficial do laudo

Fluxo atual recomendado:

1. sincronizar pesagens e testes com `POST /sync/push`;
2. localizar no backend o(s) lote(s) tecnico(s) correspondente(s);
3. emitir o laudo oficial em `POST /reports`;
4. receber de volta o `report_number`, o `sha256_hash` e o `report_json` oficial;
5. usar esses dados oficiais no PDF quando disponiveis.

## 7. O que o backend grava no laudo

Tabela: `technical_reports`

Campos principais:

- `lot_id`
- `report_number`
- `status`
- `title`
- `objective`
- `method`
- `conclusion`
- `report_json`
- `sha256_hash`
- `issued_by`
- `issued_at`

Observacao:

- o PDF nao e salvo como arquivo no banco;
- o registro tecnico oficial e o snapshot JSON do laudo.

## 8. Vinculo entre laudo e pesagens

Tabela: `technical_report_weighings`

Uso atual:

- registrar quais pesagens participam do laudo oficial;
- armazenar um snapshot da pesagem no momento do vinculo;
- melhorar rastreabilidade e auditoria do laudo emitido.

## 9. Hash e numero do laudo

Regra atual:

- o backend calcula o hash SHA-256 sobre o JSON canonico do laudo;
- o numero do laudo e derivado da data e do prefixo do hash;
- quando a emissao oficial estiver disponivel, a tela de laudos prioriza esses dados do backend.

Beneficio:

- reduz divergencia entre laudo visual e laudo salvo no banco;
- fortalece a rastreabilidade.

## 10. Situacao atual da arquitetura

Estado real em `2026-05-24`:

- operacao do front-end ainda e majoritariamente local;
- pesagem inicial ja possui gravacao hibrida local + backend;
- relatorios ja conseguem sincronizar dados e emitir laudo oficial no backend;
- banco e backend ja suportam rastreabilidade de laudo, pesagens e sincronizacao;
- agenda e pesagem final ainda precisam migrar mais profundamente para leitura/escrita centralizadas.
