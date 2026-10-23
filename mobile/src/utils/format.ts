import type { OrderStatus, StockStatus } from '../types/domain';
export const money = (value: number | null) => value === null ? '미제공' : `${new Intl.NumberFormat('ko-KR').format(value)}원`;
export const number = (value: number) => new Intl.NumberFormat('ko-KR').format(value);
export const timestamp = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
export const stockLabel: Record<StockStatus, string> = { normal: '✓ 정상', low: '! 재고 부족', out: '! 품절', expiring: '! 소비기한 임박', needs_check: '? 재고 확인 필요' };
export const orderLabel: Record<OrderStatus, string> = { draft: '초안', pending: '승인 대기', approved: '승인 완료', ordered: '발주 진행', partial: '일부 입고', received: '입고 완료', cancelled: '취소' };
export function dateRange(days: number, date: string) {
  const end = new Date(`${date}T12:00:00Z`); end.setUTCDate(end.getUTCDate() - days + 1);
  return { start: end.toISOString().slice(0, 10), end: date };
}
