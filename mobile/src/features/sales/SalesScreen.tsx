import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Chips, EmptyState, Field, Notice, ResourceState, Screen } from '../../components/common/ui';
import { MetricCard } from '../../components/cards';
import { useResource } from '../../hooks/useResource';
import { isMock, services } from '../../services';
import { DEMO_DATE } from '../../services/mock/data';
import { dateRange, money, number, timestamp } from '../../utils/format';
import { colors, ui } from '../../theme';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
export default function SalesScreen() {
  const [period, setPeriod] = useState('7'); const [range, setRange] = useState(() => dateRange(7, isMock ? DEMO_DATE : today()));
  const [start, setStart] = useState(range.start); const [end, setEnd] = useState(range.end); const [invalid, setInvalid] = useState('');
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('all');
  const query = useResource(signal => services.sales.get(range, signal), `${range.start}:${range.end}`); const data = query.data;
  const ranking = data?.ranking.filter(p => p.name.includes(search) && (category === 'all' || p.category === category)) ?? [];
  function select(value: string) { setPeriod(value); if (value !== 'custom') { const next = dateRange(Number(value), isMock ? DEMO_DATE : today()); setRange(next); setStart(next.start); setEnd(next.end); setInvalid('') } }
  function apply() {
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
    try { if (!validDate(start) || !validDate(end) || start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 366) throw new Error(); setInvalid(''); setRange({ start, end }) }
    catch { setInvalid('날짜를 YYYY-MM-DD 형식으로 확인해 주세요. 조회 범위는 최대 367일입니다.') }
  }
  const max = Math.max(1, ...(data?.trend.map(t => t.revenue) ?? []));
  return <Screen title="매출 분석" subtitle="판매 실적과 추이를 확인하세요." loading={query.loading} onRefresh={query.reload}>
    <Chips selected={period} onSelect={select} values={[{ value: '1', label: '오늘' }, { value: '7', label: '7일' }, { value: '30', label: '30일' }, { value: 'custom', label: '기간 지정' }]} />
    {period === 'custom' && <Card title="조회 기간"><Field label="시작일 (YYYY-MM-DD)" value={start} onChangeText={setStart} /><Field label="종료일 (YYYY-MM-DD)" value={end} onChangeText={setEnd} />{invalid ? <Notice error>{invalid}</Notice> : null}<Button title="기간 적용" onPress={apply} /></Card>}
    <ResourceState {...query} hasData={!!data} retry={query.reload} />
    {data && <><Text style={ui.muted}>{data.start} ~ {data.end} · 갱신 {timestamp(data.updatedAt)}</Text><View style={ui.row}><MetricCard label="실제 매출 · 데모에서는 예시" value={money(data.revenue)} note={data.changePercent === null ? '비교 데이터 미제공' : `이전 기간 대비 ${data.changePercent}%`} /><MetricCard label="매출총이익" value={money(data.grossProfit)} note="원가 미제공 시 계산하지 않아요" /></View>
      <Card title="일별 매출 추이"><Text style={ui.muted}>금액 단위: 원 · 막대와 날짜를 함께 확인하세요.</Text>{data.trend.length ? <View style={{ gap: 12 }}>{data.trend.map(row => <View key={row.date} accessibilityLabel={`${row.date} ${row.kind === 'forecast' ? '예측' : '실적'} ${money(row.revenue)}`} style={{ gap: 5 }}><View style={ui.between}><Text style={ui.muted}>{row.date.slice(5)} {row.kind === 'forecast' ? '· 예측' : '· 실적'}</Text><Text style={ui.body}>{money(row.revenue)}</Text></View><View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primarySoft }}><View style={{ height: 8, width: `${Math.max(0, row.revenue / max * 100)}%`, borderRadius: 4, backgroundColor: row.kind === 'forecast' ? colors.warning : colors.primary }} /></View></View>)}</View> : <Text style={ui.muted}>기간 내 판매 내역이 없어요.</Text>}</Card>
      <Card title="카테고리별 매출">{data.categories.map(c => <View key={c.name} style={ui.between}><Text style={ui.body}>{c.name}</Text><Text style={ui.heading}>{money(c.revenue)}</Text></View>)}{!data.categories.length && <Text style={ui.muted}>분류별 데이터가 없어요.</Text>}</Card>
      <Card title="상품 판매 순위"><Field label="상품 검색" value={search} onChangeText={setSearch} /><Chips selected={category} onSelect={setCategory} values={[{ value: 'all', label: '전체' }, ...Array.from(new Set(data.ranking.map(r => r.category))).map(c => ({ value: c, label: c }))]} />{ranking.map((p, i) => <View key={p.productId} style={{ gap: 8, paddingVertical: 10 }}><Text style={ui.heading}>{i + 1}. {p.name}</Text><Text style={ui.body}>판매 {number(p.quantity)}개 · 매출 {money(p.revenue)}</Text><Text style={ui.muted}>매출총이익 {money(p.grossProfit)}</Text><Button title="상품 보기" secondary onPress={() => router.push({ pathname: '/products/[id]', params: { id: p.productId } })} /></View>)}{!ranking.length && <Text style={ui.muted}>조건에 맞는 상품이 없어요.</Text>}</Card>
      <Card title="✦ 분석 안내"><Text style={ui.body}>{data.analysis}</Text></Card>{!data.trend.length && <EmptyState text="기간을 변경하거나 판매 데이터 수집 여부를 확인하세요." />}
    </>}
  </Screen>;
}
