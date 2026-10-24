const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const code = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
};
const { createAutomationService } = require('../src/services/automation.ts');

test('Live 자동화 어댑터: 서버 설정을 조회하고 ON/OFF 저장 및 감사 로그를 반영한다', async () => {
  let settingsCall = 0;
  let saveCall = 0;
  let runsCall = 0;
  let currentEnabled = false;
  let currentVersion = 1;

  const fakeAdapter = {
    async getSettings() {
      settingsCall++;
      return { enabled: currentEnabled, version: currentVersion, workerStatus: 'idle' };
    },
    async saveSettings(enabled, expectedVersion) {
      saveCall++;
      if (expectedVersion !== currentVersion) {
        const err = new Error('version conflict');
        err.code = 'conflict';
        throw err;
      }
      currentEnabled = enabled;
      currentVersion++;
      return { enabled: currentEnabled, version: currentVersion, workerStatus: 'idle' };
    },
    async listRuns() {
      runsCall++;
      if (currentEnabled) {
        return [
          { recommendationId: 'rec-1', productName: '신선 우유', quantity: 10, status: 'ordered', message: '자동 발주 완료', orderId: 'PO-001' }
        ];
      }
      return [];
    }
  };

  const dummyPlan = { get: async () => ({ recommendations: [] }) };
  const dummyDecisions = { capabilities: { placeOrder: true, reject: true }, placeOrder: async () => {}, reject: async () => {} };

  const auto = createAutomationService(false, dummyPlan, dummyDecisions, fakeAdapter);

  // Initial state is available: true, source: 'api'
  assert.equal(auto.getSnapshot().available, true);
  assert.equal(auto.getSnapshot().source, 'api');

  // Trigger initial load
  await auto.refresh();
  assert.equal(settingsCall >= 1, true);
  assert.equal(auto.getSnapshot().enabled, false);
  assert.equal(auto.getSnapshot().runs, 0);

  // Turn ON
  await auto.setEnabled(true);
  assert.equal(auto.getSnapshot().enabled, true);
  assert.equal(auto.getSnapshot().runs, 1);
  assert.equal(auto.getSnapshot().results[0].productName, '신선 우유');
  assert.equal(auto.getSnapshot().results[0].status, 'ordered');

  // runDemo in live mode is rejected
  await assert.rejects(auto.runDemo(), { code: 'validation' });

  // Turn OFF
  await auto.setEnabled(false);
  assert.equal(auto.getSnapshot().enabled, false);
});
