import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'DripTeste.html');
const html = await fs.readFile(filePath, 'utf8');

const listenerMatch = html.match(/clearBtn\.addEventListener\('click',\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}\);/);
assert.ok(listenerMatch, 'o listener do clearBtn deve existir em DripTeste.html');

const listenerBody = listenerMatch[1];

assert.ok(listenerBody.includes("grossEl.value = '';"), 'o botao Limpar deve limpar o campo de peso bruto');
assert.ok(listenerBody.includes("packEl.value = '0.006';"), 'o botao Limpar deve restaurar o peso de embalagem padrao');
assert.ok(listenerBody.includes("speciesEl.value = 'Frango Friato';"), 'o botao Limpar deve restaurar a especie padrao');
assert.ok(listenerBody.includes('grossEl.focus();'), 'o botao Limpar deve devolver foco ao peso bruto');

assert.ok(!listenerBody.includes('records = [];'), 'o botao Limpar nao deve apagar os registros existentes');
assert.ok(!listenerBody.includes('saveToStorage();'), 'o botao Limpar nao deve gravar exclusao de registros');
assert.ok(!listenerBody.includes('render();'), 'o botao Limpar nao deve re-renderizar a tabela por apagar registros');
