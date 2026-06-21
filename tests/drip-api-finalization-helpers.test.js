import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

async function loadApi() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(__dirname, '..', 'drip-api.js');
  const code = await fs.readFile(filePath, 'utf8');
  const window = {
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    }
  };
  const context = { window, console, fetch() {}, URLSearchParams };
  vm.runInNewContext(code, context, { filename: 'drip-api.js' });
  return window.DripApi;
}

const DripApi = await loadApi();

assert.equal(typeof DripApi.finalizeWeighing, 'function', 'o cliente de API precisa expor finalizeWeighing');
assert.equal(typeof DripApi.reopenWeighing, 'function', 'o cliente de API precisa expor reopenWeighing');
