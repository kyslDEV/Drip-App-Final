import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'DripTeste.html');
const html = await fs.readFile(filePath, 'utf8');

assert.ok(html.includes('id="newAnalysisBtn"'), 'a tela inicial deve ter botao Nova analise');
assert.ok(html.includes('const newAnalysisBtn = document.getElementById(\'newAnalysisBtn\');'), 'o script deve capturar newAnalysisBtn');

const listenerStart = html.indexOf("newAnalysisBtn.addEventListener('click', async () => {");
const listenerEnd = html.indexOf("tbody.addEventListener('click'", listenerStart);
assert.ok(listenerStart >= 0, 'o listener async do botao Nova analise deve existir');
assert.ok(listenerEnd > listenerStart, 'o listener do botao Nova analise deve ficar antes do listener da tabela');

const listenerBody = html.slice(listenerStart, listenerEnd);

assert.ok(listenerBody.includes('DripData.archiveCurrentAnalysis'), 'Nova analise deve arquivar o pacote completo');
assert.ok(listenerBody.includes('user: getUserConfig()'), 'Nova analise deve salvar o contexto operacional no pacote');
assert.ok(listenerBody.includes("localStorage.removeItem('drip_user')"), 'Nova analise deve limpar o contexto atual para forcar novo lote');
assert.ok(listenerBody.includes("window.location.href = 'login.html'"), 'Nova analise deve voltar ao login');
assert.ok(listenerBody.includes('records.forEach((record) => {'), 'Nova analise deve cancelar lembretes dos registros ativos');
