# DripTest - Analise de Requisitos

Documentos relacionados:

- `docs/ALGORITMO_DRIPTEST.md`
- `docs/AVALIACAO_SISTEMA.md`
- `docs/MODELO_BANCO_DADOS.md`
- `docs/INTEGRACAO_WEB_BANCO.md`

## 1. Objetivo

O DripTest e um aplicativo operacional para registrar, acompanhar e relatar pesagens de produto no processo de analise de gotejamento/drip. A versao atual funciona como PWA e tambem pode ser embarcada em um WebView Android.

O sistema atual cobre quatro fluxos principais:

- configuracao do monitor, lote e data de fabricacao;
- pesagem inicial;
- agendamento/cronograma de analise;
- pesagem final e relatorios.

## 2. Contexto atual do sistema

Arquivos principais:

- `login.html`: configuracao inicial da sessao operacional.
- `DripTeste.html`: cadastro da pesagem inicial.
- `DripSchedule.html`: calculo do cronograma de analise.
- `DripTestF.html`: lancamento da pesagem final.
- `DripReports.html`: relatorios, exportacao CSV, importacao CSV e relatorio completo.
- `drip-data.js`: camada central de dados, normalizacao, calculos, relatorios e importacao/exportacao.
- `drip-ui.js`: comportamento visual compartilhado.
- `service-worker.js`: cache PWA.
- `manifest.webmanifest`: metadados do app instalavel.
- `android-offline/`: empacotamento Android com WebView.

Persistencia atual:

- dados operacionais em `localStorage`, chave `driptest_store_v2`;
- configuracao do usuario/lote em `localStorage`, chave `drip_user`;
- compatibilidade com chave legada `driptest_pesagem_inicial_v1`.

## 3. Usuarios previstos

### Monitor(a)

Usuario que opera as telas no fluxo de producao.

Responsabilidades:

- informar nome, lote e data de fabricacao;
- registrar pesagens iniciais;
- acompanhar horarios de analise;
- registrar pesagens finais.

### Supervisor(a) ou qualidade

Usuario que acompanha indicadores e relatorios.

Responsabilidades:

- revisar pesagens;
- exportar CSV;
- gerar relatorios;
- verificar historico por lote, especie e monitor.

### Administrador futuro

Usuario previsto para versao com backend.

Responsabilidades:

- gerenciar usuarios;
- gerenciar plantas/unidades;
- configurar regras;
- auditar alteracoes.

## 4. Requisitos funcionais

### RF-01 - Configurar sessao de trabalho

O app deve permitir informar:

- nome do(a) monitor(a);
- data de fabricacao;
- lote.

Esses dados devem ser reaproveitados automaticamente nas pesagens iniciais.

### RF-02 - Registrar pesagem inicial

O app deve permitir cadastrar uma pesagem inicial com:

- especie;
- peso bruto em gramas;
- peso da embalagem;
- lote;
- monitor;
- data de fabricacao;
- peso liquido inicial calculado;
- tempo previsto de analise;
- indicador de tempo interpolado;
- data/hora de cadastro.

Validacoes atuais:

- peso bruto precisa ser numerico e maior que zero;
- peso da embalagem precisa ser valido;
- limite de 6 frangos para especies de frango.

### RF-03 - Calcular peso liquido inicial

O app deve calcular:

```text
peso_liquido_inicial_g = max(0, peso_bruto_g - peso_embalagem_inicial_g)
```

### RF-04 - Calcular tempo previsto pelo peso bruto

O app deve calcular o tempo de analise com base no peso bruto, usando tabela de faixas e interpolacao quando necessario.

### RF-05 - Listar e ordenar pesagens iniciais

O app deve exibir os registros cadastrados em tabela responsiva.

A tela permite:

- ver especie, lote, peso bruto, embalagem, peso liquido, tempo e status;
- ordenar por peso liquido;
- remover registros;
- limpar todos os registros.

### RF-06 - Gerar cronograma de analise

O app deve calcular horarios de analise a partir dos registros iniciais.

Regra atual:

- o registro de referencia e o de maior `timeMin`;
- em empate, vence o de maior peso bruto;
- persistindo empate, vence o mais antigo;
- os demais registros recebem offset baseado na diferenca de tempo para o registro de referencia.

### RF-07 - Registrar pesagem final

O app deve permitir finalizar uma pesagem informando peso final em gramas.

Dados de finalizacao:

- peso liquido final;
- peso bruto final estimado, quando houver embalagem final;
- embalagem final;
- perda/absorcao absoluta;
- perda/absorcao percentual;
- status `final`;
- data/hora de finalizacao.

### RF-08 - Reabrir registro finalizado

O app deve permitir reabrir um registro finalizado para correcao, removendo dados de finalizacao.

### RF-09 - Gerar laudo tecnico operacional

O app deve gerar um laudo tecnico com formato adequado para registro e avaliacao operacional.

O laudo deve conter:

- identificacao do laudo;
- objetivo;
- metodo aplicado;
- rastreabilidade;
- marca do produto;
- monitor responsavel;
- data de fabricacao;
- totais gerais;
- registros iniciais;
- registros finalizados;
- registros pendentes;
- resultados consolidados;
- conclusao;
- anexo tecnico com dados brutos;
- totais por especie;
- totais por lote;
- totais por monitor;
- ultimas pesagens;
- testes de absorcao, quando existirem.

O laudo pode ser parcial quando ainda existirem registros sem pesagem final.

### RF-10 - Exportar CSV

O app deve gerar CSV separado por ponto e virgula com registros de pesagem e testes de absorcao.

O CSV deve conter explicitamente:

- `marca_produto`;
- `monitor`;
- `data_fabricacao`;
- `lote`;
- pesos inicial e final;
- status e datas de criacao/finalizacao.

### RF-11 - Importar CSV

O app deve importar registros de pesagem a partir de CSV.

Regras atuais:

- primeira linha deve conter cabecalhos;
- registros com `tipo` diferente de `pesagem` sao ignorados;
- registros sem especie ou sem peso bruto valido sao ignorados;
- numeros com virgula sao aceitos.

### RF-12 - Gerar relatorio completo com hash

O app deve gerar um relatorio completo em nova janela, com:

- metadados;
- hash SHA-256;
- resumo;
- tabelas completas;
- JSON bruto.

### RF-13 - Funcionar como app instalavel

O app deve funcionar como PWA/app instalavel e preservar os dados locais do fluxo operacional.

Recursos atuais:

- service worker;
- cache de arquivos principais;
- armazenamento local via `localStorage`;
- versao Android com WebView e assets locais.

## 5. Requisitos nao funcionais

### RNF-01 - Uso local/mobile

O app deve manter o fluxo operacional disponivel no dispositivo e preparar evolucao para sincronizacao com servidor.

### RNF-02 - Portabilidade

O app atual deve funcionar como:

- site/PWA;
- app Android empacotado em WebView;
- base conceitual para futuro app Kotlin nativo.

### RNF-03 - Rastreabilidade

Relatorios devem conter metadados, datas e hash para ajudar verificacao posterior.

### RNF-04 - Usabilidade em campo

As telas devem ser responsivas e objetivas para uso rapido durante operacao.

### RNF-05 - Evolucao para backend

O modelo deve permitir migracao futura para:

- API;
- banco PostgreSQL;
- autenticacao;
- sincronizacao mobile;
- auditoria.

## 6. Regras de negocio identificadas

### RN-01 - Limite de frangos

A tela de pesagem inicial limita o cadastro a 6 frangos para especies:

- `Frango Friato`;
- `Frango Nutriza`;
- `Frango`.

### RN-02 - Embalagem inicial

Pesos de embalagem disponiveis na tela inicial:

- 0,006 kg = 6 g;
- 0,007 kg = 7 g;
- 0,008 kg = 8 g.

### RN-03 - Linguagem da marca do produto

No campo de especie, a exibicao permanece como:

- `Frango Friato`;
- `Frango Nutriza`.

Nos laudos e exportacoes, a marca do produto deve usar o linguajar:

- `Ave Friato`;
- `Ave Nutriza`.

### RN-04 - Tempo maximo calculado

Pesos ate 4000 g possuem tempo calculado por tabela ou interpolacao.

Pesos acima de 4000 g retornam tempo nulo na funcao central.

### RN-05 - Status

Um registro pode estar em:

- `Inicial`;
- `final`.

Um registro e considerado finalizado quando possui `finalNet` ou status `final`.

### RN-06 - Perda/absorcao final

A regra central em `drip-data.js` calcula:

```text
lossAbs = peso_liquido_inicial_g - peso_liquido_final_g
lossPct = (lossAbs / peso_liquido_inicial_g) * 100
```

Pendencia: confirmar a regra usada na tela `DripTestF.html`, pois ha um trecho em `calculateAbsorption` que deve ser revisado contra a regra central.

## 7. Modelo de dados atual

### Store local

```json
{
  "version": 2,
  "initialRecords": [],
  "absorptionTests": [],
  "updatedAt": 0
}
```

### Registro de pesagem

Campos principais:

- `id`
- `species`
- `productBrand`
- `lote`
- `monitor`
- `fabDate`
- `gross`
- `packKg`
- `packGrams`
- `net`
- `timeMin`
- `interpolated`
- `status`
- `createdAt`
- `finalGross`
- `finalNet`
- `finalPackKg`
- `finalPackGrams`
- `lossAbs`
- `lossPct`
- `finalAt`

### Teste de absorcao

Campos principais:

- `id`
- `recordId`
- `species`
- `lote`
- `baseType`
- `initialWeight`
- `finalWeight`
- `dryWeight`
- `absorption`
- `absorptionPercent`
- `note`
- `createdAt`

## 8. Requisitos futuros para banco de dados

Entidades recomendadas:

- `users`
- `plants`
- `production_lots`
- `weighings`
- `technical_reports`
- `audit_logs`

O modelo robusto esta documentado em `docs/MODELO_BANCO_DADOS.md`, o SQL base esta em `database/schema.sql` e a estrategia de integracao Web/API/Banco esta em `docs/INTEGRACAO_WEB_BANCO.md`.

Requisitos para backend:

- autenticacao por usuario;
- controle por planta/unidade;
- registros vinculados a lote;
- auditoria de criacao, alteracao, reabertura e exclusao;
- API para sincronizacao;
- suporte a dados locais pendentes de sincronizacao;
- exportacao e importacao controladas.

## 9. Riscos e pendencias

- `localStorage` nao e banco definitivo e pode ser limpo pelo navegador.
- Nao ha autenticacao real na versao atual.
- Nao ha auditoria de alteracoes.
- Nao ha controle de conflito entre dispositivos.
- A regra de perda/absorcao final precisa ser validada e unificada.
- O modulo de absorcao esta em revisao.
- Alguns textos exibidos no terminal aparecem com problema de codificacao, embora os arquivos funcionem no navegador.

## 10. Proximos passos recomendados

1. Validar oficialmente a regra de calculo da perda/absorcao final.
2. Unificar os calculos duplicados nas telas para usar apenas `drip-data.js`.
3. Criar um dicionario de dados definitivo.
4. Definir modelo relacional para PostgreSQL.
5. Evoluir a API inicial em `backend-python` com autenticacao, validacoes e endpoints completos.
6. Conectar o app Web aos endpoints de sincronizacao.
7. Implementar sincronizacao com fila de pendencias no Web.
