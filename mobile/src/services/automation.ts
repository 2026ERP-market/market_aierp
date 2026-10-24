import type { ReplenishmentService } from './replenishment';
import type { RecommendationDecisionService } from './recommendationDecisions';
import { errorMessage, ServiceError } from './errors';

export interface AutomationResult {
  runId?: string;
  recommendationId: string; productName: string; quantity: number;
  status: 'ordered' | 'skipped' | 'failed'; message: string; orderId?: string;
}
export interface AutomationSnapshot {
  source: 'mock' | 'api'; available: boolean; enabled: boolean | null;
  running: boolean; runs: number; results: AutomationResult[]; error?: string;
}
export interface AutomationService {
  getSnapshot(): AutomationSnapshot;
  subscribe(listener: () => void): () => void;
  setEnabled(enabled: boolean): Promise<void>;
  runDemo(): Promise<void>;
  refresh?(): Promise<void>;
}

export interface AutomationApiAdapter {
  getSettings(signal?: AbortSignal): Promise<{ enabled: boolean; version: number; workerStatus: string }>;
  saveSettings(enabled: boolean, expectedVersion: number): Promise<{ enabled: boolean; version: number; workerStatus: string }>;
  listRuns(signal?: AbortSignal): Promise<AutomationResult[]>;
}

// Mock event runner & live server adapter. Live automation runs on the server, never from render/GET/timers.
export function createAutomationService(
  mock: boolean,
  plan: ReplenishmentService,
  decisions: RecommendationDecisionService,
  apiAdapter?: AutomationApiAdapter
): AutomationService {
  if (!mock && apiAdapter) {
    let currentVersion = 1;
    let state: AutomationSnapshot = {
      source: 'api',
      available: true,
      enabled: false,
      running: false,
      runs: 0,
      results: []
    };
    const listeners = new Set<() => void>();
    const update = (next: Partial<AutomationSnapshot>) => {
      state = { ...state, ...next };
      listeners.forEach(listener => listener());
    };

    let initialLoadDone = false;
    async function loadInitial() {
      if (initialLoadDone) return;
      initialLoadDone = true;
      try {
        const [settings, runs] = await Promise.all([
          apiAdapter!.getSettings(),
          apiAdapter!.listRuns()
        ]);
        currentVersion = settings.version;
        update({
          enabled: settings.enabled,
          running: settings.workerStatus === 'running',
          results: runs,
          runs: runs.length,
          error: undefined
        });
      } catch (e) {
        update({ error: errorMessage(e) });
      }
    }

    void loadInitial();

    return {
      getSnapshot: () => {
        if (!initialLoadDone) void loadInitial();
        return state;
      },
      subscribe: listener => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
      async setEnabled(enabled: boolean) {
        if (state.running) throw new ServiceError('conflict', '이전 작업이 처리 중입니다. 완료 후 다시 시도해 주세요.');
        update({ running: true, error: undefined });
        try {
          const saved = await apiAdapter!.saveSettings(enabled, currentVersion);
          currentVersion = saved.version;
          const runs = await apiAdapter!.listRuns();
          update({
            enabled: saved.enabled,
            running: false,
            results: runs,
            runs: runs.length
          });
        } catch (error) {
          update({ running: false, error: errorMessage(error) });
          throw error;
        }
      },
      async runDemo() {
        throw new ServiceError('validation', '운영 API 모드에서는 runDemo를 실행할 수 없습니다. AI 자동 발주는 서버 정책에 따라 자동으로 처리됩니다.');
      },
      async refresh() {
        try {
          const [settings, runs] = await Promise.all([
            apiAdapter!.getSettings(),
            apiAdapter!.listRuns()
          ]);
          currentVersion = settings.version;
          update({
            enabled: settings.enabled,
            running: settings.workerStatus === 'running',
            results: runs,
            runs: runs.length,
            error: undefined
          });
        } catch (e) {
          update({ error: errorMessage(e) });
        }
      }
    };
  }

  let state: AutomationSnapshot = { source: mock ? 'mock' : 'api', available: mock, enabled: mock ? false : null, running: false, runs: 0, results: [] };
  const listeners = new Set<() => void>();
  const update = (next: Partial<AutomationSnapshot>) => { state = { ...state, ...next }; listeners.forEach(listener => listener()) };
  const unavailable = () => { throw new ServiceError('contract_pending', '자동 발주 서버 설정·실행·권한 API가 아직 없습니다. 서버에 요청하거나 설정을 저장하지 않았습니다.') };
  async function runDemo() {
    if (!mock) return unavailable();
    if (!state.enabled) throw new ServiceError('validation', '샘플 자동 발주 모드를 먼저 켜 주세요.');
    if (state.running) throw new ServiceError('conflict', '샘플 자동 발주가 이미 실행 중입니다.');
    update({ running: true, error: undefined, results: [] });
    const results: AutomationResult[] = [];
    try {
      const recommendations = (await plan.get()).recommendations;
      for (const rec of recommendations) {
        // OFF blocks the next item; an already submitted request may complete.
        if (!state.enabled) break;
        if (rec.status !== 'pending') continue;
        const base = { recommendationId: rec.id, productName: rec.productName, quantity: rec.quantity };
        if (!Number.isSafeInteger(rec.quantity) || rec.quantity <= 0 || rec.unitCost === null || !Number.isFinite(rec.unitCost) || rec.unitCost < 0 || !rec.supplier.trim()) {
          results.push({ ...base, status: 'skipped', message: '수량·매입가·공급업체 확인 필요' });
          continue;
        }
        try {
          const placed = await decisions.placeOrder({ recommendationId: rec.id, productId: rec.productId, aiRecommendedQuantity: rec.quantity, quantity: rec.quantity });
          results.push({ ...base, status: 'ordered', orderId: placed.order.id, message: '샘플 자동 발주 완료 · 실제 전송 없음' });
        } catch (error) { results.push({ ...base, status: 'failed', message: errorMessage(error) }) }
      }
      update({ results, runs: state.runs + 1 });
    } catch (error) { update({ error: errorMessage(error) }); throw error }
    finally { update({ running: false }) }
  }
  return {
    getSnapshot: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    async setEnabled(enabled) {
      if (!mock) return unavailable();
      if (enabled === state.enabled) return;
      if (enabled && state.running) throw new ServiceError('conflict', '이전 실행이 끝난 뒤 다시 켜 주세요.');
      update({ enabled, error: undefined });
      if (enabled) await runDemo();
    },
    runDemo,
  };
}
