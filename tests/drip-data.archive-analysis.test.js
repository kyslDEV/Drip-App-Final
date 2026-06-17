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
        return 'archive-test-id';
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
  return { DripData: window.DripData, localStorage };
}

const { DripData, localStorage } = await loadDripData();

localStorage.setItem('drip_user', JSON.stringify({
  monitorName: 'Ana',
  sectorName: 'Setor 1',
  plantName: 'Setor 1',
  shift: '1° Manhã',
  turno: '1° Manhã',
  fabDate: '2026-06-17',
  lot: 'L001'
}));

DripData.saveInitialRecords([
  {
    id: 'sample-1',
    species: 'Frango Friato',
    productBrand: 'Ave Friato',
    lote: 'L001',
    monitor: 'Ana',
    plantName: 'Setor 1',
    shift: '1° Manhã',
    turno: '1° Manhã',
    fabDate: '2026-06-17',
    gross: 2800,
    packKg: 0.006,
    packGrams: 6,
    net: 2794,
    timeMin: 205,
    interpolated: false,
    status: 'final',
    createdAt: Date.UTC(2026, 5, 17, 8, 0, 0),
    finalGross: 2640,
    finalNet: 2634,
    finalPackKg: 0.006,
    finalPackGrams: 6,
    finalAt: Date.UTC(2026, 5, 17, 10, 0, 0)
  }
]);

DripData.saveAbsorptionTest({
  id: 'abs-1',
  recordId: 'sample-1',
  species: 'Frango Friato',
  productBrand: 'Ave Friato',
  lote: 'L001',
  plantName: 'Setor 1',
  shift: '1° Manhã',
  baseType: 'initial',
  initialWeight: 100,
  finalWeight: 96,
  absorption: 4,
  absorptionPercent: 4,
  note: 'teste',
  createdAt: Date.UTC(2026, 5, 17, 11, 0, 0)
});

assert.equal(typeof DripData.archiveCurrentAnalysis, 'function', 'archiveCurrentAnalysis deve existir');
assert.equal(typeof DripData.getArchivedAnalyses, 'function', 'getArchivedAnalyses deve existir');

const archived = DripData.archiveCurrentAnalysis({
  user: JSON.parse(localStorage.getItem('drip_user'))
});

assert.equal(archived.initialRecords.length, 1, 'o pacote deve guardar registros iniciais/finais');
assert.equal(archived.absorptionTests.length, 1, 'o pacote deve guardar testes complementares');
assert.equal(archived.user.lot, 'L001', 'o pacote deve guardar o lote do contexto operacional');
assert.equal(archived.report.totals.initialRecords, 1, 'o pacote deve guardar o relatorio consolidado');
assert.equal(archived.report.totals.absorptionTests, 1, 'o relatorio do pacote deve incluir testes complementares');

assert.equal(DripData.getInitialRecords().length, 0, 'a analise ativa deve ficar sem registros iniciais depois do arquivamento');
assert.equal(DripData.getAbsorptionTests().length, 0, 'a analise ativa deve ficar sem testes depois do arquivamento');
assert.equal(JSON.parse(localStorage.getItem('drip_user')).lot, 'L001', 'drip-data nao deve remover o contexto operacional diretamente');

const archivedList = DripData.getArchivedAnalyses();
assert.equal(archivedList.length, 1, 'a lista de arquivadas deve conter o pacote salvo');
assert.equal(archivedList[0].id, archived.id, 'o pacote retornado deve ser o mesmo salvo no historico local');

const sheetData = DripData.buildAnalysisSheetData();
assert.equal(sheetData.totalAnalyses, 1, 'a planilha deve ler analises arquivadas mesmo sem analise ativa');
assert.equal(sheetData.sheets[0].analyses[0].lote, 'L001', 'a analise arquivada deve continuar disponivel na planilha');
