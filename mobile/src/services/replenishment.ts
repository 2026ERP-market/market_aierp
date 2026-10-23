import type { AgentAction, PurchaseOrder } from '../types/domain';

// 신규 화면용 제안입니다. 기존 ERP/AI API 타입과 서비스 계약은 변경하지 않습니다.
export interface InventoryPlanning {
  productId: string;
  incomingQuantity: number | null;
  salesPeriod: string;
  dailySales: { date: string; quantity: number }[];
  overstockRisk: boolean;
  riskReason: string | null;
}
export interface PurchaseRecommendation {
  id: string;
  productId: string;
  productName: string;
  supplier: string;
  unit: string;
  currentStock: number;
  demand: number;
  demandPeriod: string;
  quantity: number;
  unitCost: number | null;
  leadDays: number;
  reason: string;
  warning: string | null;
  draftId: string | null;
}
export interface ReplenishmentPlan {
  updatedAt: string;
  briefing: string;
  budget: number | null;
  recommendations: PurchaseRecommendation[];
  inventory: InventoryPlanning[];
}
export interface ReplenishmentService {
  get(signal?: AbortSignal): Promise<ReplenishmentPlan>;
  createDraft(recommendationId: string): Promise<PurchaseOrder>;
}
// AI 액션의 선택적 UI 정보입니다. 기존 AgentAction을 대체하지 않습니다.
export type ReplenishmentAction = AgentAction & { orderId?: string; recommendationId?: string };
