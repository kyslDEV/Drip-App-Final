# DripTest - Historico de Versoes de Desenvolvimento

Documentos relacionados:

- `docs/ARQUITETURA_SISTEMA.md`
- `docs/ANALISE_REQUISITOS.md`
- `docs/INTEGRACAO_WEB_BANCO.md`
- `docs/MODELO_BANCO_DADOS.md`
- `versions/README.md`

## 1. Objetivo

Este documento organiza e documenta os prototipos, pacotes Web e builds Android preservados na pasta `versions/` durante o desenvolvimento do DripTest.

O objetivo e manter uma trilha profissional de evolucao do sistema, permitindo demonstrar:

- a progressao funcional do produto;
- os marcos tecnicos de cada fase;
- a diferenca entre prototipos Web e builds Android distribuiveis;
- a preservacao dos artefatos originais para auditoria, revisao e rastreabilidade.

## 2. Escopo

O inventario foi apurado em 2026-06-04 a partir dos arquivos existentes em `versions/`.

Foram considerados:

- pacotes Web em formato `.zip`;
- builds Android de depuracao em formato `.apk`;
- data e hora de modificacao registrada no sistema de arquivos;
- tamanho dos artefatos;
- quantidade e nomes dos arquivos internos dos pacotes;
- hash SHA-256 abreviado para identificacao tecnica.

Este documento nao substitui controle de versao Git, changelog de release ou gestao formal de requisitos. Ele funciona como registro historico dos artefatos preservados durante a construcao do sistema.

## 3. Criterio de organizacao

A ordem oficial deste documento segue a data de modificacao dos arquivos, e nao apenas a numeracao presente no nome. Essa decisao e importante porque alguns pacotes usam nomes exploratorios, como `DripAppNew.zip` e `DripAppNew2.zip`, que representam marcos reais mesmo sem numeracao semantica.

Classificacao usada:

- **Prototipo Web**: pacote inicial ou intermediario em `.zip`, executado em navegador.
- **Pacote Web/PWA**: versao Web com manifest, service worker, estrutura de telas e recursos offline.
- **Pacote Web integrado**: versao Web com cliente de API ou sincronizacao.
- **Build Android**: APK debug gerado a partir do empacotamento WebView.

## 4. Linha do tempo consolidada

| Ordem | Artefato | Data | Tipo | Tamanho | Itens | Hash SHA-256 abreviado | Marco documentado |
|---:|---|---|---|---:|---:|---|---|
| 1 | `DripTestApp.zip` | 2026-05-15 20:05 | Prototipo Web | 15.9 KB | 6 | `D5280B383DD03BA7` | Primeira base preservada com telas centrais de teste, index, manifest e service worker. |
| 2 | `DripTestV3.zip` | 2026-05-15 23:02 | Prototipo Web | 16.1 KB | 6 | `DD15BA81B886A0EF` | Iteracao inicial mantendo a estrutura basica de coleta e classificacao. |
| 3 | `DripAppV4.zip` | 2026-05-18 19:06 | Pacote Web/PWA | 24.7 KB | 8 | `4B73651FAEB44F7B` | Inclusao das telas de absorcao e agendamento, ampliando o fluxo operacional. |
| 4 | `DripAppV5.zip` | 2026-05-20 16:35 | Pacote Web/PWA | 26.5 KB | 8 | `E02220A4499E6C9A` | Consolidacao do fluxo Web antes da separacao visual e de dados. |
| 5 | `DripAppV5.5.zip` | 2026-05-20 22:10 | Pacote Web/PWA | 36.0 KB | 13 | `22A27C1411282A27` | Entrada de `drip-data.js`, `drip-theme.css`, `drip-ui.js` e `DripReports.html`; inicio da organizacao modular. |
| 6 | `DripAppV5.7.zip` | 2026-05-20 22:44 | Pacote Web/PWA | 35.8 KB | 13 | `D40AF3F9D4209878` | Refinamento da base modular com relatorios e componentes compartilhados. |
| 7 | `DripAppV6.zip` | 2026-05-21 00:26 | Pacote Web/PWA | 37.5 KB | 14 | `6D5024B02314FFCF` | Inclusao de `OFFLINE.md`; amadurecimento da proposta offline-first. |
| 8 | `DripTestV6.1.zip` | 2026-05-21 01:42 | Pacote Web/PWA | 38.2 KB | 14 | `5B7B69F9B2EDB7CD` | Variacao documentada da fase V6 com a mesma composicao funcional principal. |
| 9 | `DripAppV7.zip` | 2026-05-21 02:39 | Pacote Web/PWA | 37.5 KB | 14 | `A288E4316F50DB04` | Evolucao da base offline e dos fluxos de teste, relatorio e agendamento. |
| 10 | `DripAppNew.zip` | 2026-05-21 02:49 | Pacote Web/PWA | 37.8 KB | 15 | `9211188AC31C01EF` | Inclusao de `netlify.toml`; preparacao para hospedagem/deploy Web. |
| 11 | `DripTesteV8.zip` | 2026-05-21 03:06 | Pacote Web/PWA | 37.8 KB | 15 | `34052D2E8052CE28` | Marco V8 preservado com estrutura de deploy e documentacao offline. |
| 12 | `DripAppV8.1.zip` | 2026-05-21 15:59 | Pacote Web/PWA | 39.1 KB | 15 | `DA7A99994DB1FF9D` | Ajuste incremental da familia V8. |
| 13 | `DripAppV8.5.zip` | 2026-05-21 16:40 | Pacote Web/PWA | 45.4 KB | 16 | `ACEBAAA29632010A` | Inclusao de `DripOffline.html`; reforco da experiencia offline. |
| 14 | `DripAppV10.zip` | 2026-05-22 22:37 | Pacote Web/PWA | 55.1 KB | 17 | `C660BD2CE16CA7BC` | Inclusao de `login.html`; inicio formal do fluxo de acesso antes da integracao de API. |
| 15 | `DripAppNew2.zip` | 2026-05-24 23:28 | Pacote Web integrado | 61.3 KB | 17 | `5A995E7AC32C783F` | Entrada de `drip-api.js` e `drip-sync.js`; aproximacao da arquitetura Web/PWA com backend FastAPI. |
| 16 | `DripTest_Android_v1.2_debug.apk` | 2026-05-25 13:52 | Build Android debug | 913.5 KB | - | `1477095FCDB8E2CB` | Primeiro build Android preservado nesta sequencia; WebView com assets Web embarcados. |
| 17 | `DripTest_Android_v1.3_debug.apk` | 2026-05-25 16:54 | Build Android debug | 914.2 KB | - | `5ECB50064DC451CB` | Iteracao Android mantendo a base Web embarcada. |
| 18 | `DripTest_Android_v1.4_debug.apk` | 2026-05-25 19:02 | Build Android debug | 923.6 KB | - | `0AF207ABE6A78776` | Build Android com inclusao de `DripSupervisor.html` nos assets embarcados. |
| 19 | `DripTest_Android_v1.5_debug.apk` | 2026-05-25 19:36 | Build Android debug | 924.9 KB | - | `9A4A13F05AFBF2B4` | Ultimo APK debug preservado na pasta `versions/`; corresponde a evolucao Android v1.5. |

## 5. Evolucao por fase

### 5.1 Fase inicial: prova de conceito Web

Artefatos principais:

- `DripTestApp.zip`
- `DripTestV3.zip`

Caracteristicas:

- telas essenciais de teste;
- index de navegacao;
- manifest Web;
- service worker;
- foco em validar o fluxo basico do DripTest em navegador.

### 5.2 Fase de ampliacao operacional

Artefatos principais:

- `DripAppV4.zip`
- `DripAppV5.zip`

Caracteristicas:

- entrada de tela de absorcao;
- entrada de tela de agendamento;
- ampliacao do app de uma tela de teste para um conjunto operacional maior.

### 5.3 Fase de modularizacao e relatorios

Artefatos principais:

- `DripAppV5.5.zip`
- `DripAppV5.7.zip`
- `DripAppV6.zip`
- `DripTestV6.1.zip`
- `DripAppV7.zip`

Caracteristicas:

- separacao de dados e regras em `drip-data.js`;
- entrada de `DripReports.html`;
- padronizacao visual com `drip-theme.css`;
- componentes compartilhados em `drip-ui.js`;
- documentacao inicial de roadmap e offline.

### 5.4 Fase PWA/offline e deploy Web

Artefatos principais:

- `DripAppNew.zip`
- `DripTesteV8.zip`
- `DripAppV8.1.zip`
- `DripAppV8.5.zip`

Caracteristicas:

- preservacao da base PWA;
- entrada de configuracao `netlify.toml`;
- criacao de `DripOffline.html`;
- amadurecimento do conceito offline-first.

### 5.5 Fase de acesso e integracao

Artefatos principais:

- `DripAppV10.zip`
- `DripAppNew2.zip`

Caracteristicas:

- inclusao de `login.html`;
- inclusao de `drip-api.js`;
- inclusao de `drip-sync.js`;
- aproximacao da arquitetura documentada como Web/PWA local integrado a FastAPI e PostgreSQL.

### 5.6 Fase Android/WebView

Artefatos principais:

- `DripTest_Android_v1.2_debug.apk`
- `DripTest_Android_v1.3_debug.apk`
- `DripTest_Android_v1.4_debug.apk`
- `DripTest_Android_v1.5_debug.apk`

Caracteristicas:

- empacotamento do DripTest em APK Android;
- uso de assets Web embarcados em `assets/www/`;
- manutencao da estrategia offline-first no dispositivo;
- aumento de escopo na versao v1.4 com `DripSupervisor.html` embarcado.

## 6. Composicao tecnica dos pacotes Web

| Artefato | Arquivos internos documentados |
|---|---|
| `DripTestApp.zip` | `DripTeste.html`, `DripTestF.html`, `index.html`, `launch.json`, `manifest.webmanifest`, `service-worker.js` |
| `DripTestV3.zip` | `DripTeste.html`, `DripTestF.html`, `index.html`, `launch.json`, `manifest.webmanifest`, `service-worker.js` |
| `DripAppV4.zip` | `DripAbsorption.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `index.html`, `launch.json`, `manifest.webmanifest`, `service-worker.js` |
| `DripAppV5.zip` | `DripAbsorption.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `index.html`, `launch.json`, `manifest.webmanifest`, `service-worker.js` |
| `DripAppV5.5.zip` | `DripAbsorption.html`, `drip-data.js`, `DripReports.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `manifest.webmanifest`, `ROADMAP.md`, `service-worker.js` |
| `DripAppV5.7.zip` | `DripAbsorption.html`, `drip-data.js`, `DripReports.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `manifest.webmanifest`, `ROADMAP.md`, `service-worker.js` |
| `DripAppV6.zip` | `DripAbsorption.html`, `drip-data.js`, `DripReports.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `manifest.webmanifest`, `OFFLINE.md`, `ROADMAP.md`, `service-worker.js` |
| `DripTestV6.1.zip` | `DripAbsorption.html`, `drip-data.js`, `DripReports.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `manifest.webmanifest`, `OFFLINE.md`, `ROADMAP.md`, `service-worker.js` |
| `DripAppV7.zip` | `DripAbsorption.html`, `drip-data.js`, `DripReports.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `manifest.webmanifest`, `OFFLINE.md`, `ROADMAP.md`, `service-worker.js` |
| `DripAppNew.zip` | `DripAbsorption.html`, `drip-data.js`, `DripReports.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `manifest.webmanifest`, `netlify.toml`, `OFFLINE.md`, `ROADMAP.md`, `service-worker.js` |
| `DripTesteV8.zip` | `DripAbsorption.html`, `drip-data.js`, `DripReports.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `manifest.webmanifest`, `netlify.toml`, `OFFLINE.md`, `ROADMAP.md`, `service-worker.js` |
| `DripAppV8.1.zip` | `DripAbsorption.html`, `drip-data.js`, `DripReports.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `manifest.webmanifest`, `netlify.toml`, `OFFLINE.md`, `ROADMAP.md`, `service-worker.js` |
| `DripAppV8.5.zip` | `DripAbsorption.html`, `drip-data.js`, `DripOffline.html`, `DripReports.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `manifest.webmanifest`, `netlify.toml`, `OFFLINE.md`, `ROADMAP.md`, `service-worker.js` |
| `DripAppV10.zip` | `DripAbsorption.html`, `drip-data.js`, `DripOffline.html`, `DripReports.html`, `DripSchedule.html`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `login.html`, `manifest.webmanifest`, `netlify.toml`, `OFFLINE.md`, `ROADMAP.md`, `service-worker.js` |
| `DripAppNew2.zip` | `DripAbsorption.html`, `drip-api.js`, `drip-data.js`, `DripReports.html`, `DripSchedule.html`, `drip-sync.js`, `DripTeste.html`, `DripTestF.html`, `drip-theme.css`, `drip-ui.js`, `index.html`, `launch.json`, `login.html`, `manifest.webmanifest`, `netlify.toml`, `ROADMAP.md`, `service-worker.js` |

## 7. Composicao tecnica dos APKs

Os APKs preservados sao builds de depuracao. Eles devem ser tratados como artefatos de desenvolvimento, nao como releases finais assinadas para distribuicao publica.

| Artefato | Assets Web embarcados |
|---|---:|
| `DripTest_Android_v1.2_debug.apk` | 19 |
| `DripTest_Android_v1.3_debug.apk` | 19 |
| `DripTest_Android_v1.4_debug.apk` | 20 |
| `DripTest_Android_v1.5_debug.apk` | 20 |

Arquivos Web identificados nos APKs v1.2 e v1.3:

- `DripAbsorption.html`
- `DripReports.html`
- `DripSchedule.html`
- `DripSettings.html`
- `DripTestF.html`
- `DripTeste.html`
- `ROADMAP.md`
- `drip-api.js`
- `drip-data.js`
- `drip-sync.js`
- `drip-theme.css`
- `drip-ui.js`
- `icons/icon-192.png`
- `icons/icon-512.png`
- `icons/icon.svg`
- `index.html`
- `login.html`
- `manifest.webmanifest`
- `service-worker.js`

Arquivos Web adicionais identificados nos APKs v1.4 e v1.5:

- `DripSupervisor.html`

## 8. Relacao com a arquitetura atual

A evolucao preservada em `versions/` confirma a trajetoria tecnica registrada na documentacao de arquitetura:

1. primeiro, um app Web com telas HTML independentes;
2. depois, uma base PWA/offline com service worker e manifest;
3. em seguida, modularizacao de dados, interface e relatorios;
4. depois, login e integracao com API/sincronizacao;
5. por fim, empacotamento Android WebView com os mesmos assets Web.

Essa trajetoria e coerente com a arquitetura atual do DripTest:

```text
Web/PWA offline-first
        |
        | drip-api.js / drip-sync.js
        v
FastAPI + PostgreSQL

Android WebView
        |
        v
assets/www com a mesma base Web
```

## 9. Regras de preservacao dos artefatos

Para manter valor documental e rastreabilidade, recomenda-se:

- nao renomear arquivos ja preservados em `versions/`;
- nao sobrescrever ZIPs ou APKs existentes;
- nao editar o conteudo interno de pacotes historicos;
- sempre registrar novo pacote com nome unico;
- manter data, tamanho e hash no documento quando um novo artefato for incorporado;
- diferenciar builds debug de releases oficiais;
- criar releases assinadas em pasta propria quando o sistema entrar em distribuicao formal.

## 10. Convencao recomendada para novas versoes

Para proximos artefatos, recomenda-se a seguinte convencao:

```text
DripTest_Web_vMAJOR.MINOR.PATCH_YYYY-MM-DD.zip
DripTest_Android_vMAJOR.MINOR.PATCH_debug_YYYY-MM-DD.apk
DripTest_Android_vMAJOR.MINOR.PATCH_release_YYYY-MM-DD.apk
```

Exemplos:

```text
DripTest_Web_v1.6.0_2026-06-04.zip
DripTest_Android_v1.6.0_debug_2026-06-04.apk
DripTest_Android_v1.6.0_release_2026-06-04.apk
```

## 11. Status documental

Este inventario consolida os artefatos preservados ate 2026-06-04.

O ultimo artefato Android preservado na pasta `versions/` e:

- `DripTest_Android_v1.5_debug.apk`

O ultimo pacote Web preservado na pasta `versions/` e:

- `DripAppNew2.zip`

Para continuidade do desenvolvimento, este documento deve ser atualizado sempre que uma nova versao for arquivada.
