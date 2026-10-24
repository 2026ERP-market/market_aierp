// 단가와 수량의 표시용 합계입니다. 수요 예측·최적 발주량을 계산하지 않습니다.
export function estimatedCost(items: { quantity: number; unitCost: number | null }[]): number | null {
  if (items.some(item => item.unitCost === null || !Number.isSafeInteger(item.quantity) || item.quantity < 0)) return null;
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitCost!, 0);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}
