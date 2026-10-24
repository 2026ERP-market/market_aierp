const nf = new Intl.NumberFormat('ko-KR');

/** 12,400원 */
export const won = (n: number) => `${nf.format(Math.round(n))}원`;

/** 큰 금액은 만원 단위로 줄여서: 8,900원 / 12.4만원 / 124만원 */
export const wonShort = (n: number) => {
  const v = Math.round(n);
  if (v < 10_000) return `${nf.format(v)}원`;
  const man = v / 10_000;
  return `${man < 100 ? Math.round(man * 10) / 10 : Math.round(man)}만원`;
};

/** 24개 */
export const qty = (n: number, unit: string) => `${nf.format(n)}${unit}`;

export const num = (n: number) => nf.format(n);

/** 소비기한 남은 일수를 사람이 바로 읽을 수 있는 말로 */
export const ddayLabel = (d: number) => {
  if (d < 0) return `${-d}일 지남`;
  if (d === 0) return '오늘까지';
  if (d <= 30) return `${d}일 남음`;
  return `약 ${Math.round(d / 30)}개월 남음`;
};

export type Tone = 'danger' | 'warn' | 'ok';

export const expiryTone = (d: number): Tone => (d <= 1 ? 'danger' : d <= 5 ? 'warn' : 'ok');
