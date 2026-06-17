# DripTest

DripTest e um aplicativo operacional para conduzir analises de gotejamento, da identificacao do lote ate a geracao da planilha tecnica e do laudo. O foco do sistema e padronizar a rotina no chao de fabrica, reduzir retrabalho em planilhas manuais e preservar rastreabilidade dos dados coletados.

O projeto foi construido como uma aplicacao offline-first: o operador consegue registrar as medicoes mesmo sem conexao ativa, e a integracao com backend e banco de dados pode ser usada para sincronizacao, historico oficial e auditoria.

## Problema que resolve

Analises de drip normalmente dependem de anotacoes manuais, planilhas separadas e consolidacao posterior. Isso aumenta o risco de erro, perda de dados, falta de padrao no laudo e dificuldade para recuperar o historico por lote, monitor, setor ou data.

O DripTest centraliza esse fluxo em uma experiencia unica:

- registra dados operacionais da analise;
- controla pesagem inicial e pesagem final;
- calcula indicadores do teste;
- organiza ate 3 analises na planilha;
- gera laudos e textos compartilhaveis;
- prepara a base para historico, supervisao e integracao com banco.

## O que o app entrega hoje

- Login operacional com monitor, lote, setor/planta, marca do produto e data de fabricacao.
- Tela de pesagem inicial para coleta das amostras.
- Cronograma de analise para acompanhamento dos tempos.
- Tela de pesagem final para fechamento dos registros.
- Planilha consolidada com ate 3 analises, acompanhando a rotina de segunda a sexta ou outros ciclos de coleta.
- Laudo tecnico por lote, mantendo a importancia do laudo unico.
- Compartilhamento de informacoes do laudo em formato amigavel para WhatsApp.
- Exportacao e importacao de dados para apoio operacional.
- Operacao local em navegador/PWA e empacotamento Android via WebView.
- Backend FastAPI e PostgreSQL preparados para persistencia oficial e sincronizacao.

## Fluxo operacional

1. O operador identifica a sessao de trabalho com os dados do lote e da analise.
2. A pesagem inicial registra as amostras coletadas.
3. O cronograma orienta o periodo de analise.
4. A pesagem final fecha as medicoes e calcula os resultados.
5. A planilha exibe 1, 2 ou 3 analises conforme os registros disponiveis.
6. O laudo consolida o lote e pode ser compartilhado ou usado como evidencia tecnica.
7. Quando configurado, o app sincroniza os dados com a API e o banco.

## Destaques recentes

- Planilha projetada para trabalhar com ate 3 analises.
- Botao de nova analise para iniciar novo lote preservando registros anteriores.
- Ajuste no limpar da pesagem inicial: limpa somente as entradas, mantendo os registros para avaliacao.
- Preparacao do caminho para historico estruturado no app.
- Materiais de apresentacao e dossie adicionados aos documentos do projeto.

## Arquitetura resumida

```text
Operador / Supervisor
        |
        v
Web App DripTest
HTML + CSS + JavaScript + localStorage + PWA
        |
        | drip-api.js / drip-sync.js
        v
FastAPI Backend
        |
        v
PostgreSQL
```

Distribuicao:

```text
Navegador/PWA  -> arquivos web do projeto
Android APK    -> android-offline/app/src/main/assets/www
Backend        -> backend-python/app
Banco          -> database/schema.sql
```

## Estrutura do repositorio

```text
.
|-- index.html                         # entrada principal do app
|-- login.html                         # identificacao operacional
|-- DripTeste.html                     # pesagem inicial
|-- DripSchedule.html                  # agenda e acompanhamento
|-- DripTestF.html                     # pesagem final
|-- DripReports.html                   # relatorios, laudos e planilha
|-- DripAbsorption.html                # testes complementares
|-- drip-data.js                       # regras compartilhadas e store local
|-- drip-api.js                        # cliente de API
|-- drip-sync.js                       # sincronizacao
|-- backend-python/                    # API FastAPI
|-- database/                          # schema PostgreSQL
|-- android-offline/                   # empacotamento Android WebView
|-- docs/                              # documentacao tecnica e apresentacao
```

## Como executar

### Web local

Abra `index.html` ou `login.html` no navegador para usar a aplicacao web localmente.

Para uso como PWA, publique os arquivos web em um servidor estatico ou ambiente equivalente.

### Android

O app Android fica em `android-offline/` e empacota os arquivos web dentro do WebView.

Quando houver alteracoes nos arquivos web, sincronize os assets antes de gerar o APK:

```powershell
./android-offline/sync-web-assets.ps1
```

Depois gere o APK pelo Gradle do projeto Android:

```powershell
cd android-offline
./gradlew.bat assembleDebug
```

### Backend

O backend FastAPI fica em `backend-python/` e usa PostgreSQL como base oficial.

Consulte a documentacao especifica antes de executar em ambiente integrado:

- `backend-python/README.md`
- `docs/INTEGRACAO_WEB_BANCO.md`
- `database/schema.sql`

## Status do projeto

O DripTest esta em estado de MVP operacional avancado, adequado para piloto controlado, validacao presencial e evolucao com usuarios reais.

Antes de tratar como producao corporativa plena, ainda devem ser consolidados pontos como:

- historico completo e tela de supervisor;
- fluxo definitivo de limpeza dos registros no monitor;
- autenticacao e perfis de usuario em ambiente oficial;
- deploy controlado do backend e banco;
- rotina formal de backup, auditoria e recuperacao;
- validacao tecnica presencial do fluxo de coleta.

## Materiais de apresentacao

Os materiais abaixo ajudam a apresentar o valor do projeto para lideranca, qualidade e producao:

- `docs/APRESENTACAO_GERENTE_QUALIDADE.md`
- `docs/DripTest_Dossie_Apresentacao_Producao.docx`
- `docs/Carta_de_Apresentacao_Kaio_Yuri_Sa_Lima.pdf`

## Documentacao relacionada

- `docs/ARQUITETURA_SISTEMA.md`
- `docs/ANALISE_REQUISITOS.md`
- `docs/CAPACIDADES_ATUAIS_DRIPTEST.md`
- `docs/AVALIACAO_SISTEMA.md`
- `docs/INTEGRACAO_WEB_BANCO.md`
- `docs/MODELO_BANCO_DADOS.md`
- `backend-python/README.md`
- `android-offline/README.md`

## Proximos passos

- Estruturar historico completo das analises no Drip App.
- Criar tela de supervisor para gestao e limpeza controlada de registros.
- Evoluir o backend como fonte oficial de laudos e auditoria.
- Validar o fluxo presencialmente em chao de fabrica.
- Preparar rotina de deploy, backup e documentacao de operacao.
