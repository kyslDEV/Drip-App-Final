# DripTest - Documentacao do Algoritmo

Documentos relacionados:

- `docs/ANALISE_REQUISITOS.md`
- `docs/AVALIACAO_SISTEMA.md`
- `docs/MODELO_BANCO_DADOS.md`

## 1. Visao geral

O algoritmo do DripTest transforma registros de pesagem em:

- peso liquido inicial;
- tempo previsto de analise;
- cronograma de analise;
- peso final;
- perda/absorcao;
- indicadores e relatorios.

A fonte principal das regras compartilhadas e `drip-data.js`.

## 2. Entrada principal

Na pesagem inicial, o operador informa:

- especie;
- peso bruto em gramas;
- peso da embalagem.

O sistema complementa com a configuracao salva:

- lote;
- monitor;
- data de fabricacao.

A marca do produto e registrada no campo `productBrand`. Na versao atual, quando esse campo nao existe em dados antigos, a marca e preenchida automaticamente com a propria especie.

Para os laudos e exportacoes, o sistema normaliza a marca usando a linguagem operacional:

- especie `Frango Friato` gera marca `Ave Friato`;
- especie `Frango Nutriza` gera marca `Ave Nutriza`.

## 3. Calculo do peso liquido inicial

### Formula

```text
peso_embalagem_inicial_g = round(peso_embalagem_kg * 1000)
peso_liquido_inicial_g = max(0, peso_bruto_g - peso_embalagem_inicial_g)
```

### Exemplo

```text
peso_bruto_g = 2785
peso_embalagem_kg = 0,006
peso_embalagem_inicial_g = 6
peso_liquido_inicial_g = 2779
```

## 4. Tabela de tempo por peso bruto

O tempo de analise e calculado pelo peso bruto.

| Faixa de peso bruto (g) | Tempo (min) |
| --- | ---: |
| 0 a 800 | 65 |
| 801 a 900 | 72 |
| 901 a 1000 | 79 |
| 1001 a 1100 | 86 |
| 1101 a 1200 | 93 |
| 1201 a 1300 | 100 |
| 1301 a 1400 | 107 |
| 1401 a 1500 | 114 |
| 1501 a 1600 | 121 |
| 1601 a 1700 | 128 |
| 1701 a 1800 | 135 |
| 1801 a 1900 | 142 |
| 1901 a 2000 | 149 |
| 2001 a 2100 | 156 |
| 2101 a 2200 | 163 |
| 2201 a 2300 | 170 |
| 2301 a 2400 | 177 |
| 2401 a 2500 | 184 |
| 2501 a 2600 | 191 |
| 2601 a 2700 | 198 |
| 2701 a 2800 | 205 |
| 2801 a 2900 | 212 |
| 2901 a 3000 | 219 |
| 3001 a 3100 | 226 |
| 3101 a 3200 | 233 |
| 3201 a 3300 | 240 |
| 3301 a 3400 | 247 |
| 3401 a 3500 | 254 |
| 3501 a 3600 | 261 |
| 3601 a 3700 | 268 |
| 3701 a 3800 | 275 |
| 3801 a 3900 | 282 |
| 3901 a 4000 | 289 |

## 5. Algoritmo de tempo com interpolacao

Funcao central: `computeMinutesWithInterpolation(grams)`.

### Passos

1. Arredondar o peso informado.
2. Procurar uma faixa direta onde `min <= peso <= max`.
3. Se encontrar, retornar o tempo da faixa e `interpolated = false`.
4. Se o peso for menor que o primeiro ponto medio, retornar o primeiro tempo e `interpolated = true`.
5. Se o peso for maior que 4000 g, retornar `minutes = null`.
6. Caso contrario, localizar os pontos medios inferior e superior.
7. Calcular proporcao entre os pontos.
8. Calcular tempo arredondado.
9. Retornar `interpolated = true`.

### Pontos medios

Cada faixa gera um ponto medio:

```text
ponto_medio = round((min + max) / 2)
```

Exemplo:

```text
faixa 801-900
ponto medio = round((801 + 900) / 2) = 851
tempo = 72
```

### Formula de interpolacao

```text
ratio = (peso - peso_inferior) / (peso_superior - peso_inferior)
tempo = round(tempo_inferior + ratio * (tempo_superior - tempo_inferior))
```

## 6. Criacao do registro inicial

Depois dos calculos, o registro salvo possui:

```text
id = uuid ou fallback por timestamp
species = especie escolhida
productBrand = marca do produto
lote = lote da configuracao
monitor = monitor da configuracao
fabDate = data da configuracao
gross = peso bruto
packKg = embalagem em kg
packGrams = embalagem em g
net = peso liquido inicial
timeMin = tempo calculado
interpolated = true/false
status = Inicial
createdAt = timestamp atual
```

## 7. Limite de registros

Na tela de pesagem inicial, especies de frango sao limitadas a 6 registros.

Regra:

```text
se especie for Frango Friato, Frango Nutriza ou Frango
e quantidade atual de frangos >= 6
entao bloquear novo cadastro
```

## 8. Algoritmo do cronograma

Telas: `DripSchedule.html` e aba de gotejamento em `DripTestF.html`.

### Escolha do registro de referencia

O registro de referencia e escolhido assim:

1. maior `timeMin`;
2. se empatar, maior `gross`;
3. se empatar, menor `createdAt`, ou seja, o mais antigo.

### Calculo do horario de analise

Para cada registro:

```text
offset_min = max(0, tempo_referencia_min - tempo_do_registro_min)
analysisAt = createdAt_do_registro_referencia + offset_min * 60000
```

Depois a lista e ordenada por:

1. `analysisAt` crescente;
2. `timeMin` decrescente;
3. `gross` decrescente;
4. `createdAt` crescente.

### Status do cronograma

```text
diff = analysisAt - agora
```

Regras:

- `diff <= 0`: Devido;
- `diff <= 15 minutos`: Proximo;
- demais casos: Agendado.

## 9. Pesagem final

Na tela final, o operador informa o peso final.

Regra descrita no codigo:

```text
o valor digitado e sempre o peso final liquido
```

Se uma embalagem final for selecionada:

```text
finalNet = valor_digitado
finalPackGrams = round(finalPackKg * 1000)
finalGross = finalNet + finalPackGrams
```

Se nenhuma embalagem final for selecionada:

```text
finalNet = valor_digitado
finalGross = valor_digitado
```

O registro passa a ter:

```text
status = final
finalAt = timestamp atual
```

## 10. Calculo de perda/absorcao final

A regra central em `drip-data.js` e:

```text
lossAbs = round(peso_liquido_inicial_g - peso_liquido_final_g)
lossPct = roundTwo((lossAbs / peso_liquido_inicial_g) * 100)
```

Exemplo:

```text
peso_liquido_inicial_g = 2779
peso_liquido_final_g = 2660
lossAbs = 119
lossPct = 4.28
```

## 10.1 Media de perda percentual final no laudo

A media de perda percentual final exibida no laudo segue a regra operacional do ensaio com 6 amostras:

```text
media_perda_percentual_final = truncar_2_casas(soma(lossPct das amostras finalizadas) / 6)
```

Observacao importante:

- o resultado nao deve ser arredondado para cima;
- se o calculo gerar `4.785`, o valor exibido deve ser `4.78 %`, nao `4.79 %`.

## 11. Pendencia de regra: tela final

Existe uma divergencia a validar em `DripTestF.html`.

A funcao `calculateAbsorption(record)` atualmente retorna:

```text
initialNet - finalPackGrams
```

Pela regra central de `drip-data.js`, o esperado parece ser:

```text
initialNet - finalNet
```

Antes de migrar para backend, Kotlin ou banco de dados, essa regra precisa ser confirmada com a area de negocio. A recomendacao tecnica e manter apenas uma implementacao da regra no modulo compartilhado.

## 12. Normalizacao de dados

Funcao central: `normalizeInitialRecord(item)`.

Ela garante:

- `id` sempre como texto;
- especie padrao `Outra`;
- lote, monitor e data como texto;
- pesos arredondados;
- embalagem padrao de 0,006 kg quando ausente;
- tempo recalculado quando ausente;
- status `final` quando existe peso final;
- calculo de perda/absorcao quando existe peso final.

## 13. Laudo tecnico

Funcao central: `buildReportData()`.

O relatorio operacional evoluiu para um laudo tecnico. A saida textual e a saida imprimivel devem organizar as informacoes em:

- identificacao do laudo;
- objetivo;
- metodo;
- rastreabilidade;
- resultados consolidados;
- conclusao;
- dados analiticos;
- anexo tecnico com JSON bruto e hash.

O laudo calcula:

- total de registros iniciais;
- total de registros finalizados;
- total de pendentes;
- total de testes de absorcao;
- lotes unicos;
- monitores unicos;
- especies unicas;
- marcas unicas;
- tempo total;
- tempo medio;
- peso bruto total;
- peso liquido inicial total;
- peso liquido final total;
- absorcao/perda total;
- media percentual de perda;
- registros interpolados;
- registros sem tempo calculado;
- maior e menor peso bruto;
- maior perda absoluta;
- maior perda percentual.

Tambem gera grupos por:

- especie;
- marca do produto;
- lote;
- monitor.

### Conclusao automatica

O texto de conclusao segue a situacao dos registros:

- sem pesagens: sem conclusao tecnica;
- apenas pesagens iniciais: laudo parcial;
- pesagens finais com pendencias: laudo parcial;
- todas as amostras finalizadas: laudo concluido.

## 14. Exportacao CSV

Funcao central: `buildReportCsv()`.

Formato:

- separador `;`;
- aspas duplas para campos com `;`, aspas ou quebra de linha;
- registros de pesagem usam `tipo = pesagem`;
- testes de absorcao usam `tipo = absorcao`.

Campos de contexto operacional incluidos na exportacao:

- `marca_produto`;
- `lote`;
- `monitor`;
- `data_fabricacao`.

## 15. Importacao CSV

Funcao central: `importInitialRecordsFromCsv(text)`.

### Passos

1. Ler linhas respeitando aspas.
2. Normalizar cabecalhos:
   - minusculas;
   - sem acentos;
   - caracteres especiais viram `_`.
3. Ignorar linhas com `tipo` diferente de `pesagem`.
4. Ler especie e peso bruto.
5. Ignorar se especie estiver vazia.
6. Ignorar se peso bruto for invalido ou menor/igual a zero.
7. Recalcular dados ausentes.
8. Salvar registros normalizados.

## 16. Hash SHA-256

Funcao central: `computeTextSha256(text)`.

Uso:

- gerar hash do JSON do relatorio;
- incluir hash no relatorio completo;
- ajudar verificacao de integridade.

## 17. Pseudocodigo geral

```text
iniciar app
  carregar configuracao do monitor/lote
  carregar store local
  migrar dados legados se necessario

registrar pesagem inicial
  validar peso bruto
  validar embalagem
  validar limite de frangos
  calcular embalagem em gramas
  calcular liquido inicial
  calcular tempo pelo bruto
  criar registro
  salvar store
  atualizar tela

gerar cronograma
  carregar registros
  escolher referencia
  calcular analysisAt de cada registro
  classificar status
  exibir tabela

registrar pesagem final
  validar peso final
  calcular finalNet e finalGross
  calcular perda/absorcao
  marcar como final
  salvar store
  atualizar tela

gerar relatorio
  carregar store
  separar finalizados e pendentes
  calcular totais
  agrupar por especie, lote e monitor
  gerar texto, CSV, JSON ou HTML completo
```

## 18. Recomendacoes para evolucao

1. Remover duplicacao da tabela de tempo nas telas e usar apenas `drip-data.js`.
2. Corrigir ou validar a divergencia do calculo de absorcao na tela final.
3. Criar testes automatizados para:
   - peso liquido inicial;
   - tempo por faixa;
   - interpolacao;
   - peso acima de 4000 g;
   - finalizacao;
   - relatorio;
   - importacao CSV.
4. Preparar uma camada de dominio reutilizavel para backend Python ou app Kotlin.
