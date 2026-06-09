# Pasta `versions`

Esta pasta preserva prototipos, pacotes Web e builds Android gerados durante o desenvolvimento do DripTest.

O documento oficial de historico e inventario esta em:

- `docs/HISTORICO_VERSOES_DESENVOLVIMENTO.md`

## Regra de preservacao

- Nao renomear artefatos historicos.
- Nao sobrescrever ZIPs ou APKs ja arquivados.
- Nao editar o conteudo interno dos pacotes preservados.
- Registrar novos artefatos no documento oficial em `docs/`.
- Tratar APKs com sufixo `_debug` como builds de desenvolvimento, nao como releases finais de distribuicao.

## Ordem de leitura

A ordem correta dos artefatos e cronologica, pela data de modificacao do arquivo. A numeracao no nome ajuda, mas nao deve ser usada como unico criterio, porque existem pacotes com nomes exploratorios como `DripAppNew.zip` e `DripAppNew2.zip`.

## Convencao recomendada para proximos artefatos

```text
DripTest_Web_vMAJOR.MINOR.PATCH_YYYY-MM-DD.zip
DripTest_Android_vMAJOR.MINOR.PATCH_debug_YYYY-MM-DD.apk
DripTest_Android_vMAJOR.MINOR.PATCH_release_YYYY-MM-DD.apk
```
