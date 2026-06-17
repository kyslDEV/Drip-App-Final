import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

async function loadDripData() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(__dirname, '..', 'drip-data.js');
  const code = await fs.readFile(filePath, 'utf8');
  const localStorage = createLocalStorage();
  const window = {
    localStorage,
    crypto: {
      randomUUID() {
        return '00000000-0000-4000-8000-000000000000';
      }
    }
  };

  const context = {
    window,
    console,
    TextEncoder,
    Blob: class Blob {},
    FileReader: class FileReader {},
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(code, context, { filename: 'drip-data.js' });
  return window.DripData;
}

function createFinalRecord(groupIndex, sampleIndex) {
  const createdAt = Date.UTC(2026, 5, 16 + groupIndex, 8, sampleIndex);
  const gross = 2800 + groupIndex * 10 + sampleIndex;
  const packGrams = 6;
  const finalPackGrams = 6;
  const finalGross = 2640 + groupIndex * 10 + sampleIndex;
  const finalNet = finalGross - finalPackGrams;

  return {
    id: `group-${groupIndex}-sample-${sampleIndex}`,
    species: 'Frango Friato',
    productBrand: groupIndex % 2 === 0 ? 'Ave Friato' : 'Ave Nutriza',
    lote: `L${groupIndex + 1}`,
    monitor: 'Monitor A',
    plantName: 'Setor 1',
    shift: groupIndex % 2 === 0 ? '1° Manhã' : '2° Noite',
    turno: groupIndex % 2 === 0 ? '1° Manhã' : '2° Noite',
    fabDate: `2026-06-${String(10 + groupIndex).padStart(2, '0')}`,
    gross,
    packKg: 0.006,
    packGrams,
    net: gross - packGrams,
    timeMin: 205,
    interpolated: false,
    status: 'final',
    createdAt,
    finalGross,
    finalNet,
    finalPackKg: 0.006,
    finalPackGrams,
    finalAt: createdAt + 60 * 60000,
    sampleNumber: sampleIndex + 1
  };
}

const DripData = await loadDripData();

const records = [];
for (let groupIndex = 0; groupIndex < 4; groupIndex += 1) {
  for (let sampleIndex = 0; sampleIndex < 6; sampleIndex += 1) {
    records.push(createFinalRecord(groupIndex, sampleIndex));
  }
}

DripData.saveInitialRecords(records);

assert.equal(typeof DripData.buildAnalysisSheetData, 'function', 'buildAnalysisSheetData deve ser exposta pela API pública');

const report = DripData.buildReportData();
const sheetData = DripData.buildAnalysisSheetData(report);

assert.equal(sheetData.totalAnalyses, 4, '4 grupos finalizados devem gerar 4 analises');
assert.equal(sheetData.totalSheets, 2, '4 analises devem gerar 2 folhas');
assert.equal(sheetData.sheets[0].status, 'closed', 'a primeira folha deve fechar ao completar 3 analises');
assert.equal(sheetData.sheets[0].analyses.length, 3, 'a primeira folha deve conter 3 analises');
assert.equal(sheetData.sheets[1].status, 'open', 'a segunda folha deve permanecer aberta com apenas 1 analise');
assert.equal(sheetData.sheets[1].analyses.length, 1, 'a segunda folha deve conter a 4a analise');
assert.equal(
  sheetData.sheets[0].analyses.map((analysis) => analysis.lote).join(','),
  'L1,L2,L3',
  'as tres primeiras analises devem preencher a primeira folha em ordem'
);
assert.equal(
  sheetData.sheets[1].analyses.map((analysis) => analysis.lote).join(','),
  'L4',
  'a quarta analise deve iniciar a segunda folha'
);
