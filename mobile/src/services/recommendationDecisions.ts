import type { PurchaseOrder } from '../types/domain';
import { ServiceError } from './errors';

export type RecommendationStatus = 'pending' | 'approved' | 'ordered' | 'rejected' | 'unknown';
export interface PlaceRecommendationOrder {
  recommendationId: string;
  productId: string;
  aiRecommendedQuantity: number;
  quantity: number;
}
export interface RecommendationOrderResult extends PlaceRecommendationOrder { order: PurchaseOrder }
export interface RejectRecommendation { recommendationId: string; productId: string }
export interface RecommendationDecisionService {
  capabilities: { placeOrder: boolean; reject: boolean; placeOrderUnavailableReason?: string };
  placeOrder(input: PlaceRecommendationOrder): Promise<RecommendationOrderResult>;
  reject(input: RejectRecommendation): Promise<void>;
}
export function orderQuantity(value: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new ServiceError('validation', '발주 수량은 1 이상의 정수로 입력해 주세요.');
  return Number(value);
}
export function validateDecision(input: PlaceRecommendationOrder) {
  orderQuantity(String(input.quantity));
  if (!input.recommendationId || !input.productId || !Number.isFinite(input.aiRecommendedQuantity) || input.aiRecommendedQuantity < 0) throw new ServiceError('validation', '추천 ID, 상품 ID와 AI 추천 수량을 확인해 주세요.');
}
