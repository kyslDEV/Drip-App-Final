# Limpar Entradas da Pesagem Inicial

## Objetivo

Ajustar o botao `Limpar` da tela de pesagem inicial para resetar somente as entradas do formulario, preservando os registros ja lancados e o contexto operacional salvo do monitor.

## Decisao aprovada

- O `Limpar` de `DripTeste.html` nao deve apagar registros da tabela.
- O `Limpar` deve apenas:
  - limpar `grossWeight`
  - restaurar `packWeight` para `0.006`
  - restaurar `species` para `Frango Friato`
  - devolver foco ao campo de peso bruto
- O contexto salvo em `drip_user` permanece intacto.
- A limpeza de registros do monitor fica para uma feature futura na tela de supervisor.

## Impacto esperado

- O monitor consegue continuar inserindo novas amostras sem perder o que ja registrou.
- A tabela e a persistencia de `initialRecords` continuam disponiveis para avaliacao.
- O comportamento destrutivo sai da tela operacional e pode ser redesenhado depois em fluxo administrativo.
