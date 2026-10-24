const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
// TypeScript를 설치한 뒤 npm test로 실행합니다. 추가 테스트 라이브러리는 사용하지 않습니다.
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const code = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
};
const { createMockServices } = require('../src/services/mock/index.ts');
const { createHttpClient } = require('../src/services/api/client.ts');
const { estimatedCost } = require('../src/utils/replenishment.ts');
const { resolvePlanningAction } = require('../src/features/agent/navigation.ts');
const { createApiServices } = require('../src/services/api/services.ts');
const apiFixtures = require('./api-fixtures.cjs');

test('보충 계획은 동일한 고정 샘플이며 입고 예정과 과잉 위험을 별도로 제공한다', async () => {
  const first = await createMockServices().replenishment.get();
  const second = await createMockServices().replenishment.get();
  assert.deepEqual(first, second);
  assert.equal(first.inventory.find(i => i.productId === 'bread').incomingQuantity, 10);
  assert.equal(first.inventory.find(i => i.productId === 'water').overstockRisk, true);
  assert.equal(estimatedCost(first.recommendations), 88000);
});

test('추천으로 생성한 초안은 기존 발주 서비스에서 조회되고 재고/승인은 변하지 않는다', async () => {
  const service = createMockServices();
  const before = await service.products.get('bread');
  const draft = await service.replenishment.createDraft('rec-bread');
  assert.equal(draft.id, 'DEMO-003'); assert.equal(draft.status, 'draft');
  assert.equal((await service.purchases.get(draft.id)).items[0].quantity, 10);
  assert.equal((await service.products.get('bread')).quantity, before.quantity);
  assert.equal((await service.replenishment.get()).recommendations.find(r => r.id === 'rec-bread').draftId, draft.id);
  assert.equal((await service.replenishment.createDraft('rec-bread')).id, draft.id);
  assert.equal((await service.purchases.list()).length, 3);
});

test('동일 추천의 중복 생성과 실패 요청은 초안을 중복 추가하지 않는다', async () => {
  const service = createMockServices();
  const results = await Promise.allSettled([service.replenishment.createDraft('rec-bread'), service.replenishment.createDraft('rec-bread')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await service.purchases.list()).length, 3);
  await assert.rejects(service.replenishment.createDraft('unknown'), { code: 'not_found' });
  service.setScenario('network'); await assert.rejects(service.replenishment.createDraft('rec-milk'), { code: 'network' });
  service.setScenario('normal'); assert.equal((await service.purchases.list()).length, 3);
});

test('승인 실패 시 저장된 초안 상태와 수량을 보존한다', async () => {
  const service = createMockServices();
  await service.purchases.save('DEMO-001', [12]);
  service.setScenario('network'); await assert.rejects(service.purchases.approve('DEMO-001'), { code: 'network' });
  service.setScenario('normal');
  const order = await service.purchases.get('DEMO-001');
  assert.equal(order.status, 'draft'); assert.equal(order.items[0].quantity, 12);
});

test('AI 초안 요청은 질문만으로 생성하지 않으며 명시적 액션을 제공한다', async () => {
  const service = createMockServices();
  const reply = await service.agent.send('식빵 발주서 초안을 만들어 줘');
  assert.deepEqual(resolvePlanningAction(reply.cards[0].action), { kind: 'recommendation', id: 'rec-bread' });
  assert.equal((await service.purchases.list()).length, 2);
  const existing = await service.agent.send('우유 발주 수량');
  assert.deepEqual(resolvePlanningAction(existing.cards[0].action), { kind: 'order', id: 'DEMO-001' });
});

test('AI 액션은 허용된 경로만 이동하며 임의 URL/경로를 거절한다', () => {
  assert.equal(resolvePlanningAction({ target: 'https://example.invalid' }), null);
  assert.equal(resolvePlanningAction({ target: 'purchases', orderId: '../settings' }), null);
  assert.equal(resolvePlanningAction({ target: 'inventory', orderId: 'DEMO-001' }), null);
  assert.equal(resolvePlanningAction('명령 실행'), null);
  assert.deepEqual(resolvePlanningAction({ target: 'inventory', productId: 'water' }), { kind: 'product', id: 'water' });
});

test('비용 표시에서 미제공 단가와 잘못된 수량을 0으로 대체하지 않는다', () => {
  assert.equal(estimatedCost([{ quantity: 2, unitCost: null }]), null);
  assert.equal(estimatedCost([{ quantity: NaN, unitCost: 100 }]), null);
  assert.equal(estimatedCost([{ quantity: 2, unitCost: 100 }]), 200);
});

test('원가가 없으면 대시보드와 매출총이익을 임의 계산하지 않는다', async () => {
  const service = createMockServices();
  assert.equal((await service.dashboard.get()).grossProfit, null);
  assert.equal((await service.sales.get({ start: '2026-10-24', end: '2026-10-24' })).grossProfit, null);
});
test('승인 후 재고는 늘지 않으며 중복 승인은 거절한다', async () => {
  const service = createMockServices(); const before = await service.products.get('milk');
  const results = await Promise.allSettled([service.purchases.approve('DEMO-001'), service.purchases.approve('DEMO-001')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await service.products.get('milk')).quantity, before.quantity);
  await assert.rejects(service.purchases.approve('DEMO-001'), { code: 'conflict' });
});
test('잘못된 수량을 거절하고 저장된 초안만 변경한다', async () => {
  const service = createMockServices();
  await assert.rejects(service.purchases.save('DEMO-001', [-1]), { code: 'validation' });
  await assert.rejects(service.purchases.save('DEMO-001', []), { code: 'validation' });
  const saved = await service.purchases.save('DEMO-001', [10]);
  assert.equal(saved.status, 'draft'); assert.equal(saved.estimatedCost, 21000);
  assert.equal((await service.products.get('milk')).quantity, 8);
});
test('실사 접수는 현재 수량을 덮어쓰지 않는다', async () => {
  const service = createMockServices(); await service.inventory.count({ productId: 'milk', counted: 9, reason: '수량 확인' });
  assert.equal((await service.products.get('milk')).quantity, 8);
  await assert.rejects(service.inventory.count({ productId: 'milk', counted: 9, reason: '' }), { code: 'validation' });
});
test('상품 등록/수정은 같은 서비스로 조회되며 바코드 중복을 거절한다', async () => {
  const service = createMockServices(); const input = { name: '데모 사과', barcode: 'DEMO-NEW', category: '과일', unit: '개', price: 1000 };
  const created = await service.products.save(input);
  assert.equal((await service.products.get(created.id)).quantity, 0);
  await assert.rejects(service.products.save(input), { code: 'conflict' });
  await service.products.save({ ...input, name: '데모 사과 수정' }, created.id);
  assert.equal((await service.products.get(created.id)).name, '데모 사과 수정');
});
test('빈 목록·권한·네트워크·요청 취소 상태를 구분한다', async () => {
  const service = createMockServices(); service.setScenario('empty');
  assert.deepEqual((await service.products.list()).products, []);
  service.setScenario('forbidden'); await assert.rejects(service.products.list(), { code: 'forbidden' });
  service.setScenario('network'); await assert.rejects(service.products.list(), { code: 'network' });
  const controller = new AbortController(); const pending = service.products.list(controller.signal); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
test('데모 AI 응답과 데이터 부족 상태를 구분한다', async () => {
  const service = createMockServices();
  assert.equal((await service.agent.send('이익 분석')).state, 'data_insufficient');
  assert.equal((await service.agent.send('없는상품')).state, 'not_found');
  assert.equal((await service.agent.send('우유 발주')).cards[0].action.target, 'purchases');
});
test('HTTP 401/403/409/500을 성공으로 처리하거나 데모로 대체하지 않는다', async () => {
  const original = global.fetch;
  try {
    for (const [status, code] of [[401, 'unauthorized'], [403, 'forbidden'], [409, 'conflict'], [500, 'server']]) {
      global.fetch = async () => new Response('', { status });
      await assert.rejects(createHttpClient('https://example.invalid')('/test', () => { throw new Error('성공 응답 검증에 도달하면 안 됨') }), { code });
    }
  } finally { global.fetch = original }
});
test('HTTP 클라이언트는 주입한 토큰을 전달하고 204를 처리한다', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url, init) => { assert.equal(init.headers.get('Authorization'), 'Bearer test-only'); return new Response(null, { status: 204 }) };
    assert.equal(await createHttpClient('https://example.invalid', async () => 'test-only')('/test', value => { assert.equal(value, undefined); return undefined }), undefined);
  } finally { global.fetch = original }
});

test('JSON 파싱 오류와 잘못된 응답 구조는 invalid_response이며 Mock으로 대체하지 않는다', async () => {
  const original = global.fetch;
  const decode = value => {
    if (!value || typeof value !== 'object' || typeof value.total !== 'number') throw new Error('잘못된 스키마');
    return { total: value.total };
  };
  const request = createHttpClient('https://example.invalid');
  try {
    global.fetch = async () => new Response('{"total":12}');
    assert.deepEqual(await request('/test', decode), { total: 12 });
    for (const body of ['not-json', '{"total":"12"}', 'null', '[]']) {
      global.fetch = async () => new Response(body);
      await assert.rejects(request('/test', decode), { code: 'invalid_response' });
    }
  } finally { global.fetch = original }
});

test('HTTP 요청 취소와 timeout을 구분한다', async () => {
  const original = global.fetch;
  global.fetch = async (_url, init) => new Promise((_resolve, reject) => {
    const abort = () => reject(new DOMException('취소됨', 'AbortError'));
    if (init.signal.aborted) abort(); else init.signal.addEventListener('abort', abort, { once: true });
  });
  try {
    await assert.rejects(createHttpClient('https://example.invalid', undefined, 20)('/test', value => value), { code: 'timeout' });
    const controller = new AbortController();
    const pending = createHttpClient('https://example.invalid')('/test', value => value, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
  } finally { global.fetch = original }
});
test('API 모드의 주소 누락과 미지원 쓰기를 네트워크 호출 없이 차단한다', async () => {
  process.env.EXPO_PUBLIC_DATA_SOURCE = 'api';
  const original = global.fetch; global.fetch = () => { throw new Error('호출되면 안 됨') };
  try {
    const { services } = require('../src/services/index.ts');
    await assert.rejects(services.dashboard.get(), { code: 'validation' });
    await assert.rejects(services.purchases.approve('x'), { code: 'contract_pending' });
    const { replenishmentService } = require('../src/services/index.ts');
    await assert.rejects(replenishmentService.get(), { code: 'validation' });
    await assert.rejects(replenishmentService.createDraft('rec-milk'), { code: 'contract_pending' });
  } finally { global.fetch = original; delete process.env.EXPO_PUBLIC_DATA_SOURCE }
});

test('API 조회는 서버 필드를 변환하고 한 화면의 중복 조회를 공유한다', async () => {
  const original = global.fetch; const calls = [];
  global.fetch = async url => {
    calls.push(url); const path = new URL(url).pathname;
    const payload = { '/api/v1/inventory/current': apiFixtures.inventory, '/api/v1/dashboard/summary': apiFixtures.dashboard, '/api/v1/purchases/recommend': apiFixtures.recommendations, '/api/v1/purchases/orders': apiFixtures.orders }[path];
    assert.ok(payload, path); return Response.json(payload);
  };
  try {
    const api = createApiServices({ baseUrl: 'https://server.invalid' }); const signal = new AbortController().signal;
    const [summary, stock, orders, plan] = await Promise.all([api.services.dashboard.get(signal), api.services.products.list(signal), api.services.purchases.list(signal), api.replenishment.get(signal)]);
    assert.equal(summary.store.name, '서버 매장'); assert.equal(stock.products[0].id, 'p10');
    assert.equal(stock.products[0].barcode, ''); assert.equal(stock.products[0].recentSales, null);
    assert.equal(stock.updatedAt, '2026-10-24T01:30:00Z');
    assert.equal(orders[0].items[0].name, '서버 우유'); assert.equal(orders[0].items[0].recommended, null);
    assert.deepEqual(orders[0].allowedActions, []); assert.equal(orders[0].receipts[0].date, null);
    assert.equal(plan.recommendations[0].quantity, 24); assert.equal(plan.budget, null);
    assert.equal(plan.inventory[0].incomingQuantity, 30); assert.equal(plan.inventory[0].overstockRisk, null);
    assert.equal(calls.filter(url => url.includes('/inventory/current')).length, 1);
    assert.ok(calls.findIndex(url => url.includes('/dashboard/summary')) < calls.findIndex(url => url.includes('/purchases/recommend')));
    await api.services.products.list(new AbortController().signal);
    assert.equal(calls.filter(url => url.includes('/inventory/current')).length, 2);
    await assert.rejects(api.services.products.get('missing'), { code: 'not_found' });
  } finally { global.fetch = original }
});

test('API 실패·잘못된 데이터·빈 배열을 Mock 데이터로 대체하지 않는다', async () => {
  const original = global.fetch; const api = createApiServices({ baseUrl: 'https://server.invalid' });
  try {
    global.fetch = async () => { throw new TypeError('offline') };
    await assert.rejects(api.services.products.list(), { code: 'network' });
    for (const status of [401, 403, 500]) {
      global.fetch = async () => new Response('', { status });
      await assert.rejects(api.services.products.list(), { code: status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : 'server' });
    }
    for (const payload of [{}, { products: [], updated_at: 'invalid' }, { ...apiFixtures.inventory, products: [{ ...apiFixtures.inventory.products[0], total_qty: '8' }] }]) {
      global.fetch = async () => Response.json(payload);
      await assert.rejects(api.services.products.list(), { code: 'invalid_response' });
    }
    global.fetch = async () => Response.json({ ...apiFixtures.inventory, products: [] });
    assert.deepEqual((await api.services.products.list()).products, []);
  } finally { global.fetch = original }
});

test('API 미지원 쓰기·타 매장 발주·잘못된 설정은 서버 요청 전에 차단한다', async () => {
  const original = global.fetch; global.fetch = async () => { throw new Error('요청되면 안 됩니다') };
  try {
    const api = createApiServices({ baseUrl: 'https://server.invalid' });
    await assert.rejects(api.services.products.save({}), { code: 'contract_pending' });
    await assert.rejects(api.services.inventory.count({}), { code: 'contract_pending' });
    await assert.rejects(api.services.purchases.save('PO-10', [10]), { code: 'contract_pending' });
    await assert.rejects(api.services.purchases.approve('PO-10'), { code: 'contract_pending' });
    await assert.rejects(api.replenishment.createDraft('REC-10'), { code: 'contract_pending' });
    await assert.rejects(createApiServices({ baseUrl: 'https://server.invalid', warehouseId: 'OTHER' }).services.purchases.list(), { code: 'contract_pending' });
    for (const baseUrl of ['', 'http://YOUR_DEV_SERVER:8000', 'https://user:password@server.invalid', 'file:///tmp']) {
      await assert.rejects(createApiServices({ baseUrl }).services.products.list(), { code: 'validation' });
    }
  } finally { global.fetch = original }
});

test('API AI 질문은 POST로 전송하고 구조화 액션을 검증한다', async () => {
  const original = global.fetch; const api = createApiServices({ baseUrl: 'https://server.invalid', tokenProvider: async () => 'test-token' });
  const reply = { id: 'server-message', role: 'assistant', state: 'success', content: '서버 답변', cards: [{ title: '우유', text: '상세', action: { label: '재고', target: 'inventory', product_id: 'p10' } }] };
  global.fetch = async (url, init) => { assert.match(url, /agent\/chat\?warehouse_id=WH-ASAN$/); assert.equal(init.method, 'POST'); assert.deepEqual(JSON.parse(init.body), { message: '재고 확인' }); assert.equal(init.headers.get('Authorization'), 'Bearer test-token'); return Response.json(reply) };
  try {
    const result = await api.services.agent.send(' 재고 확인 '); assert.equal(result.content, '서버 답변'); assert.deepEqual(resolvePlanningAction(result.cards[0].action), { kind: 'product', id: 'p10' });
    reply.cards[0].action.target = 'https://evil.invalid'; await assert.rejects(api.services.agent.send('재고 확인'), { code: 'invalid_response' });
  } finally { global.fetch = original }
});

test('API 판매 기간을 정확히 매핑하고 미지원 과거 기간·서버 기간 불일치를 거절한다', async () => {
  const original = global.fetch; const api = createApiServices({ baseUrl: 'https://server.invalid' });
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const start = new Date(Date.parse(today) - 6 * 86400000).toISOString().slice(0, 10);
  const payload = { start_date: start, end_date: today, total_revenue: 1000, trend: [], categories: [], ranking: [] };
  global.fetch = async url => { assert.match(url, /summary\?days=6$/); return Response.json(payload) };
  try {
    const result = await api.services.sales.get({ start, end: today }); assert.equal(result.revenue, 1000); assert.equal(result.updatedAt, null);
    payload.start_date = today; await assert.rejects(api.services.sales.get({ start, end: today }), { code: 'invalid_response' });
    await assert.rejects(api.services.sales.get({ start: '2020-01-01', end: '2020-01-07' }), { code: 'contract_pending' });
  } finally { global.fetch = original }
});
