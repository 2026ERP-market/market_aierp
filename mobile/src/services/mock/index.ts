import type { Services } from '../contracts';
import { requireInteger, ServiceError } from '../errors';
import { DEMO_DATE, DEMO_TIME, seedOrders, seedProducts } from './data';
import type { ProductInput } from '../../types/domain';
import type { ReplenishmentAction, ReplenishmentService } from '../replenishment';
import { planningInventory, purchaseRecommendations } from './replenishment-data';
export type MockScenario = 'normal' | 'empty' | 'network' | 'forbidden';
export function createMockServices(): Services & { replenishment: ReplenishmentService; setScenario(value: MockScenario): void; getScenario(): MockScenario } {
  let products = seedProducts();
  let orders = seedOrders();
  const recommendationDrafts = new Map(purchaseRecommendations.filter(r => r.draftId).map(r => [r.id, r.draftId!]));
  let nextDraft = 3;
  let scenario: MockScenario = 'normal';
  const locks = new Set<string>();
  const clone = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
  async function wait(signal?: AbortSignal) {
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('취소됨', 'AbortError')) };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 250);
      signal?.addEventListener('abort', abort, { once: true });
    });
    signal?.throwIfAborted();
    if (scenario === 'network') throw new ServiceError('network', '데모: 네트워크 오류 상태입니다. 설정에서 정상 상태로 돌아갈 수 있어요.');
    if (scenario === 'forbidden') throw new ServiceError('forbidden', '데모: 조회 권한이 없습니다.');
  }
  const product = (id: string) => { const value = products.find(p => p.id === id); if (!value) throw new ServiceError('not_found', '상품을 찾지 못했어요.'); return value };
  const order = (id: string) => { const value = orders.find(o => o.id === id); if (!value) throw new ServiceError('not_found', '발주서를 찾지 못했어요.'); return value };
  async function mutation<T>(key: string, operation: () => T): Promise<T> {
    if (locks.has(key)) throw new ServiceError('conflict', '이미 처리 중인 요청입니다.');
    locks.add(key);
    try { await wait(); return clone(operation()) } finally { locks.delete(key) }
  }
  function validateProduct(input: ProductInput) {
    if (!input.name.trim() || !input.barcode.trim() || !input.category.trim() || !input.unit.trim()) throw new ServiceError('validation', '상품명, 바코드, 분류, 단위를 입력해 주세요.');
    requireInteger(input.price, '판매가');
  }
  return {
    setScenario(value) { scenario = value },
    getScenario() { return scenario },
    replenishment: {
      async get(signal) {
        await wait(signal);
        return clone({ updatedAt: DEMO_TIME, budget: 100000,
          briefing: scenario === 'empty' ? '검토할 샘플 추천이 없습니다.' : '우유와 식빵의 보충 계획을 검토하세요. 달걀은 소비기한을 먼저 확인하고, 샘물은 추가 발주를 신중히 결정하세요. 고정 데모 브리핑입니다.',
          recommendations: scenario === 'empty' ? [] : purchaseRecommendations.map(r => ({ ...r, draftId: recommendationDrafts.get(r.id) ?? null })),
          inventory: scenario === 'empty' ? [] : planningInventory,
        });
      },
      async createDraft(recommendationId) {
        return mutation(`recommendation:${recommendationId}`, () => {
          if (scenario === 'empty') throw new ServiceError('not_found', '현재 검토할 발주 추천이 없습니다.');
          const recommendation = purchaseRecommendations.find(r => r.id === recommendationId);
          if (!recommendation) throw new ServiceError('not_found', '발주 추천을 찾지 못했어요.');
          const existing = recommendationDrafts.get(recommendationId);
          if (existing) return order(existing);
          const id = `DEMO-${String(nextDraft++).padStart(3, '0')}`;
          const draft = { id, supplier: recommendation.supplier, status: 'draft' as const, createdAt: DEMO_TIME,
            estimatedCost: recommendation.unitCost === null ? null : recommendation.quantity * recommendation.unitCost,
            allowedActions: ['save', 'approve'] as ('save' | 'approve')[], receipts: [],
            items: [{ productId: recommendation.productId, name: recommendation.productName, currentStock: product(recommendation.productId).quantity,
              expectedSales: recommendation.demand, leadDays: recommendation.leadDays, recommended: recommendation.quantity,
              quantity: recommendation.quantity, unit: recommendation.unit, unitCost: recommendation.unitCost, reason: recommendation.reason, warning: recommendation.warning }],
          };
          orders.push(draft); recommendationDrafts.set(recommendationId, id); return draft;
        });
      },
    },
    dashboard: { async get(signal) {
      await wait(signal);
      const visible = scenario === 'empty' ? [] : products;
      return { store: { id: 'demo', name: '동네마켓 · 데모 매장', timezone: 'Asia/Seoul' }, date: DEMO_DATE, updatedAt: DEMO_TIME,
        revenue: scenario === 'empty' ? null : 1285000, changePercent: scenario === 'empty' ? null : 8.2, grossProfit: null,
        stockoutCount: visible.filter(p => p.risk.status === 'low' || p.risk.status === 'out').length,
        expiringCount: visible.filter(p => p.risk.status === 'expiring').length,
        pendingCount: scenario === 'empty' ? 0 : orders.filter(o => o.allowedActions.includes('approve')).length,
        briefing: scenario === 'empty' ? '분석할 샘플 데이터가 없습니다.' : '우유 재고와 달걀 소비기한을 먼저 확인해 보세요. 실제 AI 분석이 아닌 고정된 데모 문구입니다.',
        todos: scenario === 'empty' ? [] : [{ label: '우유·식빵 재고 확인', target: 'inventory' }, { label: '우유 발주 초안 검토', target: 'purchases' }] };
    } },
    sales: { async get(range, signal) {
      await wait(signal);
      const start = Date.parse(`${range.start}T00:00:00+09:00`); const end = Date.parse(`${range.end}T00:00:00+09:00`);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || (end - start) / 86400000 > 366) throw new ServiceError('validation', '시작일과 종료일을 확인해 주세요. 최대 367일을 조회할 수 있어요.');
      const trend = scenario === 'empty' ? [] : Array.from({ length: Math.floor((end - start) / 86400000) + 1 }, (_, i) => ({ date: new Date(start + i * 86400000 + 9 * 3600000).toISOString().slice(0, 10), revenue: 800000 + (i % 7) * 97000, kind: 'actual' as const }));
      return { ...range, revenue: trend.reduce((sum, row) => sum + row.revenue, 0), changePercent: null, grossProfit: null, trend,
        categories: scenario === 'empty' ? [] : [{ name: '유제품', revenue: 69600 }, { name: '음료', revenue: 30000 }],
        ranking: scenario === 'empty' ? [] : products.map(p => ({ productId: p.id, name: p.name, category: p.category, quantity: p.recentSales ?? 0, revenue: (p.recentSales ?? 0) * p.price, grossProfit: null })).sort((a, b) => b.revenue - a.revenue),
        analysis: '기간별 추이와 상품 순위는 UI 확인용 독립 샘플입니다. 합계와의 대사·실제 수익 분석에 사용하지 마세요.', updatedAt: DEMO_TIME };
    } },
    products: {
      async list(signal) { await wait(signal); return { products: scenario === 'empty' ? [] : clone(products), updatedAt: DEMO_TIME } },
      async get(id, signal) { await wait(signal); return clone(product(id)) },
      async save(input, id) { return mutation(`product:${id ?? 'new'}`, () => {
        validateProduct(input);
        if (products.some(p => p.barcode === input.barcode.trim() && p.id !== id)) throw new ServiceError('conflict', '이미 등록된 바코드입니다.');
        if (id) { const existing = product(id); Object.assign(existing, input); return existing }
        const created = { ...input, id: `demo-${Date.now()}`, quantity: 0, purchasePrice: null, safetyStock: null, supplier: null, recentSales: null, risk: { status: 'needs_check' as const, reason: '데모 신규 상품: 재고 확인이 필요합니다.' }, batches: [], movements: [] };
        products.push(created); return created;
      }) },
    },
    inventory: { async count(input) { await mutation(`count:${input.productId}`, () => {
      requireInteger(input.counted);
      if (!input.reason.trim()) throw new ServiceError('validation', '실사 사유를 입력해 주세요.');
      product(input.productId); // 실사 기록 접수 예시만 제공합니다. 현재 재고를 덮어쓰지 않습니다.
    }) } },
    purchases: {
      async list(signal) { await wait(signal); return scenario === 'empty' ? [] : clone(orders) },
      async get(id, signal) { await wait(signal); return clone(order(id)) },
      async save(id, quantities) { return mutation(`order:${id}`, () => {
        const value = order(id);
        if (!value.allowedActions.includes('save')) throw new ServiceError('conflict', '수정 가능한 초안이 아닙니다.');
        if (quantities.length !== value.items.length) throw new ServiceError('validation', '상품 수량을 모두 확인해 주세요.');
        quantities.forEach(q => requireInteger(q));
        value.items.forEach((item, i) => { item.quantity = quantities[i]! });
        value.estimatedCost = value.items.every(i => i.unitCost !== null) ? value.items.reduce((sum, i) => sum + i.quantity * i.unitCost!, 0) : null;
        return value;
      }) },
      async approve(id) { return mutation(`order:${id}`, () => {
        const value = order(id);
        if (!value.allowedActions.includes('approve')) throw new ServiceError('conflict', '현재 상태에서 승인할 수 없습니다.');
        if (!value.items.some(i => i.quantity > 0)) throw new ServiceError('validation', '발주 수량이 1개 이상이어야 합니다.');
        value.status = 'approved'; value.allowedActions = []; return value;
      }) },
      async receive(id, lines) { return mutation(`order:${id}`, () => {
        const value = order(id);
        lines.forEach(l => requireInteger(l.receivedQty));
        value.status = 'received'; value.allowedActions = [];
        value.receipts = value.items.map((item, i) => ({ date: '2026-10-24', name: item.name, quantity: lines[i]?.receivedQty ?? item.quantity }));
        return value;
      }) },
    },
    agent: { async send(message, signal) {
      await wait(signal);
      if (!message.trim()) throw new ServiceError('validation', '질문을 입력해 주세요.');
      if (scenario === 'empty') return { id: `reply-${Date.now()}`, role: 'assistant', content: '데모: 재고·발주 데이터가 부족해 추천할 수 없어요.', state: 'data_insufficient' };
      if (message.includes('이익')) return { id: `reply-${Date.now()}`, role: 'assistant', content: '데모: 원가 데이터가 충분하지 않아 매출총이익을 분석할 수 없어요.', state: 'data_insufficient' };
      if (message.includes('없는상품')) return { id: `reply-${Date.now()}`, role: 'assistant', content: '데모: 해당 상품을 찾지 못했어요.', state: 'not_found' };
      if (message.includes('과잉')) return { id: `reply-${Date.now()}`, role: 'assistant', state: 'success', content: '데모: 샘물은 최근 판매가 감소하고 있어 추가 발주를 신중히 검토하는 예시입니다. 실제 위험 분석은 서버가 제공해야 합니다.', cards: [{ title: '샘물 과잉 위험 · 샘플', text: planningInventory.find(i => i.productId === 'water')!.riskReason!, action: { label: '샘물 재고 상세', target: 'inventory', productId: 'water' } }] };
      if (message.includes('초안')) {
        const recommendation = purchaseRecommendations.find(r => message.includes('식빵') ? r.productId === 'bread' : r.productId === 'milk')!;
        const existing = recommendationDrafts.get(recommendation.id);
        const action: ReplenishmentAction = existing ? { label: '발주서 상세 확인', target: 'purchases', orderId: existing } : { label: '데모 초안 만들기', target: 'purchases', recommendationId: recommendation.id };
        return { id: `reply-${Date.now()}`, role: 'assistant', state: 'success', content: '데모: 초안 생성 요청을 확인했어요. 아래 버튼에서 추천을 확인하고 초안을 만들 수 있습니다. 질문만으로 주문이 생성·승인되지는 않아요.', cards: [{ title: `${recommendation.productName} · 초안 검토`, text: `${recommendation.reason}\n추천 ${recommendation.quantity}${recommendation.unit} · 예상 수요 ${recommendation.demand}${recommendation.unit} · 예상 금액 ${recommendation.unitCost === null ? '미제공' : `${recommendation.unitCost * recommendation.quantity}원`}`, action }] };
      }
      const draftId = recommendationDrafts.get('rec-milk');
      const action: ReplenishmentAction = { label: '발주서 상세 확인', target: 'purchases', orderId: draftId };
      return { id: `reply-${Date.now()}`, role: 'assistant', state: 'success', content: '고정된 데모 응답입니다. 우유 재고가 적어 발주 초안 검토를 권하는 예시예요. 실제 AI 호출이나 자동 발주는 수행하지 않았습니다.', cards: [{ title: '우유 발주 추천 · 샘플', text: '추천 30개 · 예상 비용 63,000원 · 납기 1일. 데모 수요 예측을 기준으로 한 예시입니다.', action }] };
    } },
  };
}
