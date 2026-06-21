# Supervisor vê Monitor pela API

## Objetivo

Garantir que a etapa da análise feita pelo monitor apareça automaticamente para o supervisor, sem devolver ao supervisor qualquer ação de gestão, login técnico ou configuração da API.

## Decisão aprovada

- O monitor continua registrando a análise no fluxo normal (`DripTeste.html` e `DripTestF.html`).
- A API passa a ser o ponto central recomendado para compartilhar o andamento entre dispositivos na mesma rede.
- O supervisor volta a consultar a API apenas em modo leitura, com atualização automática da tela.
- O módulo Dev continua sendo o único local de gestão da API, teste técnico, token e conexão.
- O supervisor não ganha botão de login, sincronização manual, teste de API ou atalho para `DripSettings.html`.

## Arquitetura escolhida

1. `DripTeste.html` já envia a pesagem inicial para o backend e mantém o `backendId` local.
2. `DripTestF.html` passa a enviar também a finalização e a reabertura para o backend quando o registro já estiver vinculado ao banco.
3. `DripSupervisor.html` consulta periodicamente a API, normaliza os registros vindos do backend e mescla com o snapshot local para mostrar o estado mais completo disponível.
4. A tela do supervisor exibe a origem consolidada dos dados, mas sem expor controles técnicos de integração.

## Regras de produto

- Se a API estiver desabilitada, o supervisor continua operando com a base local.
- Se a API estiver habilitada e acessível, a visão do supervisor deve refletir automaticamente o avanço do monitor.
- Quando existir pareamento entre registro local e registro do backend, o estado vindo da API prevalece para status, etapa e pesagem final.
- Avisos críticos de não conformidade ficam fora deste pacote; esta entrega prepara a base para adicioná-los depois.

## Fora do escopo

- Novo sistema de alertas críticos.
- WebSocket, push ou canal tempo real dedicado.
- Gestão da API fora do módulo Dev.
