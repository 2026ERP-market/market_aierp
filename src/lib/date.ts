export const startOfToday = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export const addDays = (base: Date, n: number) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** 오늘 기준 남은 일수 (오늘 = 0, 지난 날짜 = 음수) */
export const daysUntil = (iso: string, today: Date) =>
  Math.round((parse(iso).getTime() - today.getTime()) / 86_400_000);

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const shortDate = (iso: string) => {
  const d = parse(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAYS[d.getDay()]})`;
};

export const todayLabel = (today: Date) =>
  `${today.getMonth() + 1}월 ${today.getDate()}일 ${WEEKDAYS[today.getDay()]}요일`;
