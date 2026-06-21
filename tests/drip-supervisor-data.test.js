import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

async function loadSupervisorData() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(__dirname, '..', 'drip-supervisor-data.js');
  const code = await fs.readFile(filePath, 'utf8');
  const window = {};
  const context = { window, console, Date };
  vm.runInNewContext(code, context, { filename: 'drip-supervisor-data.js' });
  return window.DripSupervisorData;
}

const DripSupervisorData = await loadSupervisorData();

assert.equal(typeof DripSupervisorData.mergeRecords, 'function', 'mergeRecords deve ficar disponivel para a tela Supervisor');

const localRows = [
  {
    id: 'local-1',
    clientRecordId: 'local-1',
    source: 'local',
    syncStatus: 'synced',
    lot: 'L001',
    createdAt: '2026-06-17T12:00:00.000Z',
    finalNet: null,
    status: 'running',
    stage: 'Em gotejamento',
    responsible: 'Ana',
    sampleType: 'Frango',
    observations: 'Turno 1'
  }
];

const serverRows = [
  {
    id: 'backend-1',
    serverId: 'backend-1',
    clientRecordId: 'local-1',
    source: 'server',
    lot: 'L001',
    createdAt: '2026-06-17T12:00:00.000Z',
    finalNet: 2630,
    status: 'done',
    stage: 'Finalizado',
    responsible: 'Ana',
    sampleType: 'Frango',
    observations: 'Turno: 1 Manha'
  }
];

const merged = DripSupervisorData.mergeRecords(localRows, serverRows);

assert.equal(merged.length, 1, 'o mesmo registro local e do banco deve virar uma linha unica');
assert.equal(merged[0].source, 'merged', 'quando houver pareamento a origem deve indicar mescla local + API');
assert.equal(merged[0].serverId, 'backend-1', 'o registro mesclado deve preservar o ID do banco');
assert.equal(merged[0].clientRecordId, 'local-1', 'o registro mesclado deve preservar o ID local para navegacao');
assert.equal(merged[0].status, 'done', 'o status vindo do banco deve prevalecer quando o registro ja foi sincronizado');
assert.equal(merged[0].stage, 'Finalizado', 'a etapa final do banco deve prevalecer no registro mesclado');

