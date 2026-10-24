import type { Services } from '../contracts';
import type { ReplenishmentService } from '../replenishment';
import { ServiceError } from '../errors';
import { createHttpClient } from './client';
import * as decode from './decoders';

interface Config { baseUrl: string; warehouseId?: string; tokenProvider?: () => Promise<string | null> }
const unsupported = async (): Promise<never> => { throw new ServiceError('contract_pending', '이 쓰기 작업은 연동 준비 중입니다. 서버의 추천 승인·발주서 발행과 모바일 초안 흐름을 먼저 합의해야 합니다.') };

export function createApiServices({ baseUrl, warehouseId = 'WH-ASAN', tokenProvider }: Config): { services: Services; replenishment: ReplenishmentService } {
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
      save: unsupported,
    },
    inventory: { count: unsupported },
    purchases: { list: purchases, get: async (id, signal) => { const order = (await purchases(signal)).find(item => item.id === id); if (!order) throw new ServiceError('not_found', '발주서를 찾지 못했습니다.'); return order }, save: unsupported, approve: unsupported },
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
      return decode.orders([poPayload], decode.inventory(inventoryPayload))[0];
    },
  };
  return { services, replenishment };
}
