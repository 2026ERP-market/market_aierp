import { RecommendationDecisionForm } from './RecommendationDecisionForm';
import { Text, View } from 'react-native';
import { Card, Notice } from '../common/ui';
import type { InventoryPlanning, PurchaseRecommendation } from '../../services/replenishment';
import { money, number } from '../../utils/format';
import { colors, ui } from '../../theme';

export function BudgetCard({ budget, estimatedCost, label }: { budget: number | null; estimatedCost: number | null; label: string }) {
  const over = budget !== null && estimatedCost !== null && estimatedCost > budget;
  return <Card title="발주 예산 확인"><View style={ui.between}><Text style={ui.body}>검토 예산</Text><Text style={ui.heading}>{money(budget)}</Text></View><View style={ui.between}><Text style={ui.body}>{label}</Text><Text style={ui.heading}>{money(estimatedCost)}</Text></View>{over && <Notice error>검토 예산을 초과했습니다. 수량과 기존 입고 예정 물량을 확인하세요.</Notice>}<Text style={ui.muted}>예산은 검토용 정보입니다. 실제 승인 가능 여부는 서버 권한과 업무 규칙을 따릅니다.</Text></Card>;
}

export function RecommendationCard({ recommendation, onChanged, loading }: { recommendation: PurchaseRecommendation; onChanged?: () => void | Promise<void>; loading?: boolean }) {
  return <RecommendationDecisionForm recommendation={recommendation} onChanged={onChanged} loading={loading} />;
}

export function SalesQuantityTrend({ planning, unit }: { planning?: InventoryPlanning; unit: string }) {
  const max = Math.max(1, ...(planning?.dailySales.map(row => row.quantity) ?? []));
  return <Card title="발주 판단을 위한 판매 추세">
    <Text style={ui.muted}>{planning?.salesPeriod ?? '기간 미제공'} · 판매량 단위: {unit}</Text>
    {planning?.dailySales.length ? planning.dailySales.map(row => <View key={row.date} style={{ gap: 6 }}>
      <View style={ui.between}><Text style={ui.muted}>{row.date}</Text><Text style={ui.body}>{number(row.quantity)}{unit}</Text></View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primarySoft }}><View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primary, width: `${row.quantity / max * 100}%` }} /></View>
    </View>) : <Text style={ui.muted}>판매 추세가 아직 제공되지 않았어요.</Text>}
    <Text style={ui.muted}>판매 실적이며 미래 수요 예측과 구분합니다.</Text>
  </Card>;
}
