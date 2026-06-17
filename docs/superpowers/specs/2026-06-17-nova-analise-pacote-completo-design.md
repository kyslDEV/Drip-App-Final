# Nova Analise com Pacote Completo

## Objetivo

Criar o fluxo `Nova analise` para fechar a analise ativa, salvar um pacote local completo e voltar ao login para cadastrar o proximo lote.

## Decisao aprovada

- O botao `Nova analise` fica na tela de pesagem inicial.
- Ao acionar, o app salva o pacote completo da analise atual:
  - configuracao operacional (`drip_user`)
  - registros iniciais e finalizacoes presentes em `initialRecords`
  - testes complementares em `absorptionTests`
  - relatorio consolidado gerado no momento do fechamento
- Depois de salvar o pacote, o app limpa a analise ativa.
- O contexto operacional atual e removido para forcar novo cadastro no `login.html`.
- O app redireciona para `login.html` para iniciar o proximo lote.

## Fora do escopo

- Tela de historico estruturado.
- Limpeza administrativa de registros por supervisor.
- Sincronizacao especifica dos pacotes arquivados com backend.
