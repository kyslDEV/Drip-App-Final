# DripTest Roadmap

## Curto prazo

- Consolidar a operacao em tres modulos: `Pesagem inicial`, `Pesagem final` e `Relatorios`.
- Manter `Absorcao` como modulo em revisao ate a regra de negocio ficar fechada.
- Finalizar exportacao/importacao via CSV compativel com Excel para backup e carga manual.

## Splash Screen

Objetivo:
- exibir identidade do app por 1 a 2 segundos;
- informar se o app esta carregando dados locais ou sincronizando;
- servir como ponto futuro para autenticacao e bootstrap.

Estrutura sugerida:
- `splash.html` ou overlay no `index.html`;
- logo `DT`, nome do app, status textual e barra/animacao curta;
- fechar automaticamente quando:
  - service worker estiver pronto;
  - store local for carregado;
  - configuracoes de tema forem aplicadas.

Estados previstos:
- `Iniciando app`
- `Carregando dados locais`
- `Sincronizando com servidor`
- `App mobile`

## Banco de dados futuro

Fase 1:
- continuar com `localStorage`/store local versionado para prototipo e PWA.

Fase 2:
- migrar para backend com API e banco relacional.
- stack sugerida:
  - API: `Node.js + Fastify` ou `.NET`
  - Banco: `PostgreSQL`
  - Auth: usuarios por planta/setor
  - Hospedagem: VPS, Render, Railway, Azure ou AWS

Entidades principais:
- `users`
- `plants`
- `production_lots`
- `initial_weighings`
- `final_weighings`
- `reports`
- `attachments`
- `audit_logs`

Modelo de relacao inicial:
- um `lot` possui varias `initial_weighings`
- cada `initial_weighing` pode gerar uma `final_weighing`
- relatorios consolidam por `lot`, `data`, `planta`, `turno` e `especie`

## Sistema maior

Capacidades futuras:
- dashboards por turno, lote e especie;
- filtros por periodo e unidade;
- trilha de auditoria;
- anexos de fotos/laudos;
- exportacao Excel e PDF;
- sincronizacao entre app mobile e servidor.

## Proximo passo recomendado

1. Fechar o layout e os campos obrigatorios do CSV de importacao.
2. Definir o cabecalho padrao do relatorio operacional.
3. Escolher stack do backend.
4. Planejar a primeira API: `lotes`, `pesagens`, `relatorios`.
