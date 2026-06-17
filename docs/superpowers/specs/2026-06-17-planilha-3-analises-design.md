# Planilha Sequencial de 3 Analises

## Objetivo

Adicionar uma planilha operacional separada do laudo atual, capaz de exibir ate 3 analises independentes por folha.

## Decisoes aprovadas

- O laudo atual permanece sem alteracoes de fluxo ou regra.
- A planilha nao consolida 3 analises do mesmo lote.
- Cada analise da planilha representa um conjunto independente de amostras finalizadas.
- A folha aceita 1, 2 ou 3 analises.
- Quando existir uma 4a analise, ela deve iniciar automaticamente uma nova folha.
- O historico estruturado de folhas fica para um ciclo posterior.

## Estrutura funcional

- Cada analise continua sendo identificada pelo contexto operacional ja usado no app:
  - lote
  - turno
  - data de fabricacao
  - marca do produto
- A planilha agrupa amostras finalizadas desse contexto em um bloco de analise.
- Cada bloco continua mostrando ate 6 amostras, formulas, drip medio e anomalias.
- A renderizacao final deve empacotar esses blocos em folhas sequenciais com ate 3 blocos por folha.

## Limites deste ciclo

- Nao criar tela de historico.
- Nao persistir planilhas abertas/fechadas como entidade propria.
- Nao alterar emissao de laudo oficial, PDF do laudo, CSV ou sincronizacao do backend alem do necessario para a nova planilha.
