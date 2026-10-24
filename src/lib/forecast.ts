/**
 * 수요예측 계수 — 실데이터로 학습해 앱에 이식한 부분.
 *
 * 데이터: Kaggle Store-Item-Demand Forecasting Challenge (2013-2017, 일별 판매)
 * 모델:  log1p(판매) ~ 추세 + 요일 + 월 + 연도   (Ridge 회귀, scikit-learn)
 * 백테스트(마지막 90일, 500개 품목):
 *   - 평균 sMAPE 12.4%  (seasonal-naive 18.6%, naive 27.5%, MA7 21.9%)
 *   - MASE 0.66  (seasonal-naive 대비 34% 정확, 500개 전부에서 우위)
 *   - 95% 예측구간 실제 포함률 93.3%  (구간 보정 양호)
 *
 * 학습은 오프라인에서 끝내고(scikit-learn), 앱은 "학습된 요일 계수"를 적용해 추론만 한다.
 * - 요일 계수: 전 품목 평균, 평균 1.0 기준. 주말이 평일보다 높다(마트 수요 패턴과 일치).
 * - 월 계절성도 학습했으나 그 수치는 학습 데이터(해외 유통) 고유라 국내 마트에 그대로
 *   적용하지 않는다. 보편적으로 방어 가능한 요일 패턴만 이식한다.
 * - 변동계수 CV=0.143: 계절성 제거 후 잔차 sigma/mean 의 중앙값 → 안전재고 산출에 사용.
 *
 * 실제 운영에서는 이 계수를 SystemEver 판매실적으로 재학습해 대체한다.
 */

// Date.getDay() 순서(0=일 … 6=토)로 정렬한 요일 계수 (평균 1.0 기준)
const DOW_FACTOR = [1.1846, 0.8003, 0.9252, 0.926, 0.9902, 1.0545, 1.1192];

/** 잔차 변동계수(실데이터 중앙값). 일수요 표준편차 ≈ CV × 일수요 평균 */
export const RESIDUAL_CV = 0.1431;

/** 서비스수준 → 정규분포 z값 (품절 허용 확률의 역분위수) */
export const SERVICE_Z: Record<number, number> = { 0.9: 1.28, 0.95: 1.65, 0.98: 2.05 };

/** 기본 서비스수준: 품절 허용 5% */
export const SERVICE_LEVEL = 0.95;

const shift = (base: Date, n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);

/**
 * 외부 수요 신호 — SystemEver 연동 지점.
 *
 * 분석으로 확인한 사실: 달력(추세·요일·월)만으로 뽑은 예측의 잔차는 사실상 포아송 계수잡음
 * (측정 CV 0.143 ≈ 이론 1/√평균 0.142)이다. 즉 달력 모델은 이미 신호를 다 뽑았고,
 * 정확도를 더 높이는 유일한 길은 "달력만으로 알 수 없는" 외부 신호를 더하는 것이다.
 *   - 행사/할인 여부, 가격 변동, 공휴일·명절, 날씨, 지역 이벤트 …
 * 이 값들은 SystemEver(영업 판매실적·가격·프로모션)에서 와야 하며, 여기에 배수로 곱한다.
 * 데모 데이터엔 해당 신호가 없어 기본 1.0(영향 없음)이고, 실제 연동 시 ERP 값으로 대체한다.
 */
export interface DemandSignal {
  /** 날짜별 수요 배수 (1.0 = 영향 없음). 예: 행사일 1.3, 명절 전날 1.5, 폭염 음료 1.4 */
  factor(date: Date): number;
}

const NEUTRAL: DemandSignal = { factor: () => 1 };

/** 하루 예측 수요 = 기준 일판매율 × 요일계수 × 외부신호(기본 1.0) */
export function dailyForecast(baseDaily: number, date: Date, signal: DemandSignal = NEUTRAL): number {
  return baseDaily * DOW_FACTOR[date.getDay()] * signal.factor(date);
}

/** from(포함)부터 days일 동안의 예측 수요 합계 (= 발주주기 총수요). 집계라 일별보다 오차가 작다. */
export function expectedDemand(baseDaily: number, from: Date, days: number, signal: DemandSignal = NEUTRAL): number {
  let sum = 0;
  for (let i = 0; i < days; i++) sum += dailyForecast(baseDaily, shift(from, i), signal);
  return sum;
}

/**
 * 안전재고 = z · σ · √L   (σ = 일수요 표준편차 ≈ CV × 일수요평균, L = 리드타임)
 * 서비스수준(기본 95%)에서 리드타임 동안 품절을 막는 여유 재고. 감이 아니라 수식으로 산출.
 */
export function safetyStock(baseDaily: number, leadDays: number, service = SERVICE_LEVEL): number {
  const z = SERVICE_Z[service] ?? 1.65;
  const sigmaDaily = RESIDUAL_CV * baseDaily;
  return z * sigmaDaily * Math.sqrt(Math.max(1, leadDays));
}

/** 기간 안에 수요가 높은(요일계수 ≥ 1.1) 요일 이름 — 추천 근거 설명용 */
export function peakWeekdays(from: Date, days: number): string[] {
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  const set = new Set<string>();
  for (let i = 0; i < days; i++) {
    const d = shift(from, i);
    if (DOW_FACTOR[d.getDay()] >= 1.1) set.add(names[d.getDay()]);
  }
  return [...set];
}
