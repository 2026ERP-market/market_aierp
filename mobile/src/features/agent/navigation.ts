type Destination = { kind: 'order' | 'product' | 'recommendation'; id: string } | { kind: 'list'; target: 'inventory' | 'purchases' | 'sales' };
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

// AI 문장/URL을 실행하지 않고 허용된 ERP 경로와 식별자만 사용합니다.
export function resolvePlanningAction(value: unknown): Destination | null {
  if (!value || typeof value !== 'object' || !('target' in value)) return null;
  const target = value.target;
  if (target !== 'inventory' && target !== 'purchases' && target !== 'sales') return null;
  if ('orderId' in value && value.orderId !== undefined) return target === 'purchases' && safeId(value.orderId) ? { kind: 'order', id: value.orderId } : null;
  if ('recommendationId' in value && value.recommendationId !== undefined) return target === 'purchases' && safeId(value.recommendationId) ? { kind: 'recommendation', id: value.recommendationId } : null;
  if ('productId' in value && value.productId !== undefined) return safeId(value.productId) ? { kind: 'product', id: value.productId } : null;
  return { kind: 'list', target };
}
