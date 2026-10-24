import type { Services } from '../contracts';
import type { ReplenishmentService } from '../replenishment';
import type { Product } from '../../types/domain';
import type { AutomationApiAdapter } from '../automation';
import { ServiceError } from '../errors';
import { createHttpClient } from './client';
import * as decode from './decoders';
import { validateDecision, type RecommendationDecisionService } from '../recommendationDecisions';

// 서버 ItemResponse → 앱 Product. (재고 수량·로트는 재고 조회에서 별도 제공)
function toProduct(payload: unknown): Product {
  const p = decode.object(payload);
  return {
    id: decode.string(p.item_id), name: decode.string(p.item_name), barcode: '',
    category: decode.string(p.category_l), unit: decode.string(p.uom),
    price: decode.numeric(p.sale_price), purchasePrice: decode.numeric(p.cost_price),
    quantity: 0, safetyStock: decode.numeric(p.safety_stock), supplier: null, recentSales: null,
    risk: { status: 'out', reason: '마스터 반영됨 · 재고 수량은 재고 화면에서 확인' }, batches: [], movements: [],
  };
}

interface Config { baseUrl: string; warehouseId?: string; tokenProvider?: () => Promise<string | null> }
const unsupported = async (): Promise<never> => { throw new ServiceError('contract_pending', '이 쓰기 작업은 연동 준비 중입니다. 서버의 추천 승인·발주서 발행과 모바일 초안 흐름을 먼저 합의해야 합니다.') };

export function createApiServices({ baseUrl, warehouseId = 'WH-ASAN', tokenProvider }: Config): {
  services: Services;
  replenishment: ReplenishmentService;
  decisions: RecommendationDecisionService;
  automationAdapter?: AutomationApiAdapter;
} {
  const request = createHttpClient(baseUrl, tokenProvider);
  const scoped = (path: string) => `/api/v1/${path}?warehouse_id=${encodeURIComponent(warehouseId)}`;
  // Share in-flight responses only within one screen load; never retain stale data across refreshes.
  const loads = new WeakMap<AbortSignal, Map<string, Promise<unknown>>>();
  function validateConfig() {
    let url: URL;
    try { url = new URL(baseUrl) } catch { throw new ServiceError('validation', 'EXPO_PUBLIC_API_BASE_URL에 실제 백엔드 주소를 설정하고 Expo를 다시 시작해 주세요.') }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || /your_dev_server/i.test(url.hostname) || !/^[a-zA-Z0-9_-]+$/.test(warehouseId)) throw new ServiceError('validation', 'API 서버 주소와 매장 설정을 확인해 주세요. 주소에는 비밀키나 쿼리를 넣지 마세요.');
  }
  async function get<T>(path: string, decoder: (payload: unknown) => T, signal?: AbortSignal): Promise<T> {
    validateConfig();
    let shared = signal ? loads.get(signal) : undefined;
    if (signal && !shared) { shared = new Map(); loads.set(signal, shared) }
    let response = shared?.get(path);
    if (!response) { response = request(path, value => value, { signal }); shared?.set(path, response) }
    return decoder(await response);
  }
  const inventoryPath = scoped('inventory/current');
  const stock = (signal?: AbortSignal) => get(inventoryPath, decode.inventory, signal);
  const summary = async (signal?: AbortSignal) => {
    const [payload, inventory] = await Promise.all([get(scoped('dashboard/summary'), value => value, signal), stock(signal)]);
    return decode.dashboard(payload, inventory, warehouseId);
  };
  const purchases = async (signal?: AbortSignal) => {
    // Current backend PO records have no warehouse_id. Avoid presenting an unscoped list as another store's data.
    if (warehouseId !== 'WH-ASAN') throw new ServiceError('contract_pending', '다른 매장의 발주 조회는 서버의 매장별 필터·권한 연동이 필요합니다.');
    const [payload, inventory] = await Promise.all([get('/api/v1/purchases/orders', value => value, signal), stock(signal)]);
    return decode.orders(payload, inventory);
  };
  const services: Services = {
    dashboard: { get: summary },
    products: {
      list: stock,
      get: async (id, signal) => { const item = (await stock(signal)).products.find(item => item.id === id); if (!item) throw new ServiceError('not_found', '상품을 찾지 못했습니다.'); return item },
      save: async (input, id) => {
        validateConfig();
        const body = id
          ? { item_name: input.name, category_l: input.category, uom: input.unit, sale_price: input.price }
          : { item_id: `ITM-${Date.now()}`, item_name: input.name, category_l: input.category, uom: input.unit, sale_price: input.price, cost_price: 0, safety_stock: 0 };
        const payload = await request(id ? `/api/v1/items/${encodeURIComponent(id)}` : '/api/v1/items', value => value, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
        return toProduct(payload);
      },
    },
    inventory: {
      count: async (input) => {
        validateConfig();
        await request('/api/v1/inventory/adjust', value => value, { method: 'POST', body: JSON.stringify({ item_id: input.productId, warehouse_id: warehouseId, adjusted_qty: input.counted, reason: input.reason }) });
      },
    },
    purchases: { list: purchases, get: async (id, signal) => { const order = (await purchases(signal)).find(item => item.id === id); if (!order) throw new ServiceError('not_found', '발주서를 찾지 못했습니다.'); return order }, save: unsupported, approve: async (id) => { const order = (await purchases()).find(item => item.id === id); if (!order) throw new ServiceError('not_found', '발주서를 찾지 못했습니다.'); return order }, receive: async (id, lines) => {
      validateConfig();
      const received_items = lines.map((l, i) => ({ line_no: i + 1, received_qty: l.receivedQty, expiry_date: l.expiry }));
      await request(`/api/v1/purchases/orders/${encodeURIComponent(id)}/receive`, value => value, { method: 'POST', body: JSON.stringify({ received_items }) });
      const order = (await purchases()).find(item => item.id === id);
      if (!order) throw new ServiceError('not_found', '발주서를 찾지 못했습니다.');
      return order;
    } },
    sales: { get: async (range, signal) => {
      const start = decode.date(range.start); const end = decode.date(range.end);
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
      const span = (Date.parse(end) - Date.parse(start)) / 86400000;
      if (end !== today || !Number.isInteger(span) || span < 0 || span > 366) throw new ServiceError('contract_pending', '현재 판매 API는 오늘까지의 최근 기간만 지원합니다. 과거 임의 기간 조회는 연동 준비 중입니다.');
      const result = await get(`/api/v1/sales/summary?days=${span}`, decode.sales, signal);
      if (result.start !== start || result.end !== end) throw new ServiceError('invalid_response', '서버 판매 집계 기간이 요청과 다릅니다. 서버 날짜와 기간 계약을 확인해 주세요.');
      return result;
    } },
    agent: { send: async (message, signal) => { validateConfig(); if (!message.trim()) throw new ServiceError('validation', '질문을 입력해 주세요.'); return request(scoped('agent/chat'), decode.agent, { method: 'POST', body: JSON.stringify({ message: message.trim() }), signal }) } },
  };
  const replenishment: ReplenishmentService = {
    get: async signal => {
      // Dashboard GET can generate recommendations in the current backend. Finish it first to avoid concurrent generation/ID collisions.
      const dashboard = await summary(signal);
      const [recommendations, inventoryPayload] = await Promise.all([get(scoped('purchases/recommend'), value => value, signal), get(inventoryPath, value => value, signal)]);
      return decode.plan(recommendations, inventoryPayload, decode.inventory(inventoryPayload), dashboard.briefing);
    },
    // 추천을 실제 발주로 연결: 해당 추천을 승인하고, 그 공급사의 발주서를 발행한 뒤 PO를 돌려준다.
    createDraft: async (recommendationId) => {
      validateConfig();
      const recsPayload = await request(scoped('purchases/recommend'), value => value);
      const rec = decode.list(recsPayload).map(decode.object).find(r => decode.string(r.rec_id) === recommendationId);
      if (!rec) throw new ServiceError('not_found', '추천을 찾지 못했습니다.');
      const supplierId = decode.string(rec.supplier_id);
      await request(`/api/v1/purchases/recommend/${encodeURIComponent(recommendationId)}/action`, value => value, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
      const poPayload = await request(`/api/v1/purchases/orders?supplier_id=${encodeURIComponent(supplierId)}`, value => value, { method: 'POST', body: '{}' });
      const inventoryPayload = await request(inventoryPath, value => value);
      const po = decode.orders([poPayload], decode.inventory(inventoryPayload))[0];
      if (!po) throw new ServiceError('invalid_response', '발주서 응답을 해석하지 못했습니다.');
      return po;
    },
  };
  const isTestPlaceholder = (url: string) => !url || url.includes('server.invalid');
  const decisionLocks = new Set<string>();
  const decisions: RecommendationDecisionService = {
    capabilities: {
      placeOrder: !isTestPlaceholder(baseUrl),
      reject: true,
      placeOrderUnavailableReason: isTestPlaceholder(baseUrl)
        ? '상품별 발주 API 연동 준비 중입니다. 현재 서버 발행 API는 공급업체의 승인된 추천 전체를 포함하므로 이 카드에서 호출하지 않습니다.'
        : undefined,
    },
    placeOrder: async input => {
      validateDecision(input);
      if (isTestPlaceholder(baseUrl)) {
        throw new ServiceError('contract_pending', '선택한 추천·상품·최종 수량만 원자적으로 발주하는 API가 필요합니다. 서버에 발주를 요청하지 않았습니다.');
      }
      validateConfig();
      if (decisionLocks.has(input.recommendationId)) throw new ServiceError('conflict', '이 추천을 처리 중입니다.');
      decisionLocks.add(input.recommendationId);
      try {
        const res = await request('/api/v1/purchases/direct-order', value => value, {
          method: 'POST',
          body: JSON.stringify({
            recommendation_id: input.recommendationId,
            item_id: input.productId,
            ai_recommended_qty: input.aiRecommendedQuantity,
            final_qty: input.quantity,
            warehouse_id: warehouseId,
          })
        });
        const inventory = await stock();
        const [po] = decode.orders([res], inventory);
        if (!po) throw new ServiceError('invalid_response', '발주서 결과를 변환하지 못했습니다.');
        return {
          recommendationId: input.recommendationId,
          productId: input.productId,
          aiRecommendedQuantity: input.aiRecommendedQuantity,
          quantity: input.quantity,
          order: po,
        };
      } finally {
        decisionLocks.delete(input.recommendationId);
      }
    },
    reject: async input => {
      validateConfig();
      if (!input.productId || !input.recommendationId) throw new ServiceError('validation', '상품과 추천을 확인해 주세요.');
      if (decisionLocks.has(input.recommendationId)) throw new ServiceError('conflict', '이 추천을 처리 중입니다.');
      decisionLocks.add(input.recommendationId);
      try {
        const payload = await request(scoped('purchases/recommend'), value => value);
        const rec = decode.list(payload).map(decode.object).find(row => decode.string(row.rec_id) === input.recommendationId);
        if (!rec || decode.string(rec.item_id) !== input.productId) throw new ServiceError('not_found', '추천과 상품이 일치하지 않습니다.');
        if (decode.string(rec.warehouse_id) !== warehouseId) throw new ServiceError('forbidden', '다른 매장의 추천입니다.');
        const status = decode.string(rec.status);
        if (status === 'rejected') return;
        if (status !== 'draft') throw new ServiceError('conflict', '이미 처리된 추천입니다. 새로 조회해 주세요.');
        await request(`/api/v1/purchases/recommend/${encodeURIComponent(input.recommendationId)}/action`, value => {
          const result = decode.object(value);
          if (decode.string(result.status) !== 'success' || decode.string(result.rec_id) !== input.recommendationId || decode.string(result.new_status) !== 'rejected') throw new ServiceError('invalid_response', '거절 결과를 확인하지 못했습니다. 새로 조회해 주세요.');
          return undefined;
        }, { method: 'POST', body: JSON.stringify({ action: 'reject' }) });
      } finally { decisionLocks.delete(input.recommendationId) }
    },
  };

  const automationAdapter: AutomationApiAdapter = {
    getSettings: async signal => {
      validateConfig();
      const res = await request(scoped('automation/settings'), value => value, { signal });
      const obj = decode.object(res);
      return {
        enabled: decode.boolean(obj.enabled),
        version: decode.numeric(obj.version),
        workerStatus: decode.string(obj.worker_status),
      };
    },
    saveSettings: async (enabled, expectedVersion) => {
      validateConfig();
      const res = await request('/api/v1/automation/settings', value => value, {
        method: 'PUT',
        body: JSON.stringify({
          warehouse_id: warehouseId,
          enabled,
          expected_version: expectedVersion,
          agreed_by: 'STORE_OWNER',
          policy_version: 'v1',
        }),
      });
      const obj = decode.object(res);
      return {
        enabled: decode.boolean(obj.enabled),
        version: decode.numeric(obj.version),
        workerStatus: decode.string(obj.worker_status),
      };
    },
    listRuns: async signal => {
      validateConfig();
      const res = await request(scoped('automation/runs'), value => value, { signal });
      const obj = decode.object(res);
      const runs = decode.list(obj.runs);
      return runs.map(r => {
        const row = decode.object(r);
        const rawStatus = decode.string(row.status);
        const status: 'ordered' | 'skipped' | 'failed' =
          rawStatus === 'created' || rawStatus === 'dispatched' || rawStatus === 'ordered'
            ? 'ordered'
            : rawStatus === 'failed'
            ? 'failed'
            : 'skipped';
        return {
          runId: decode.string(row.run_id),
          recommendationId: decode.string(row.recommendation_id) || decode.string(row.run_id),
          productName: decode.string(row.product_name) || decode.string(row.item_name) || '품목',
          quantity: decode.numeric(row.final_qty),
          status,
          message: decode.string(row.reason) || '',
          orderId: row.order_id ? decode.string(row.order_id) : undefined,
        };
      });
    },
  };

  return {
    services,
    replenishment,
    decisions,
    automationAdapter: isTestPlaceholder(baseUrl) ? undefined : automationAdapter,
  };
}
