import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, ConfirmDialog, Notice } from '../common/ui';
import { useAction } from '../../hooks/useAction';
import { isMock, replenishmentService } from '../../services';
import type { InventoryPlanning, PurchaseRecommendation } from '../../services/replenishment';
import { money, number } from '../../utils/format';
import { colors, ui } from '../../theme';

export function BudgetCard({ budget, estimatedCost, label }: { budget: number | null; estimatedCost: number | null; label: string }) {
  const over = budget !== null && estimatedCost !== null && estimatedCost > budget;
  return <Card title="발주 예산 확인"><View style={ui.between}><Text style={ui.body}>검토 예산</Text><Text style={ui.heading}>{money(budget)}</Text></View><View style={ui.between}><Text style={ui.body}>{label}</Text><Text style={ui.heading}>{money(estimatedCost)}</Text></View>{over && <Notice error>검토 예산을 초과했습니다. 수량과 기존 입고 예정 물량을 확인하세요.</Notice>}<Text style={ui.muted}>예산은 검토용 정보입니다. 실제 승인 가능 여부는 서버 권한과 업무 규칙을 따릅니다.</Text></Card>;
}

export function RecommendationCard({ recommendation, onChanged }: { recommendation: PurchaseRecommendation; onChanged?: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const action = useAction();
  const cost = recommendation.unitCost === null ? null : recommendation.unitCost * recommendation.quantity;
  async function create() {
    let id: string | undefined;
    const ok = await action.run(async () => { id = (await replenishmentService.createDraft(recommendation.id)).id }, '데모 초안을 만들었어요.');
    setConfirm(false);
    if (ok && id) { onChanged?.(); router.push({ pathname: '/purchase-orders/[id]', params: { id } }) }
  }
  return <Card title={recommendation.productName}>
    <View style={ui.between}><Badge label={`추천 ${recommendation.quantity}${recommendation.unit}`} /><Text style={ui.heading}>{money(cost)}</Text></View>
    <Text style={ui.body}>현재 {recommendation.currentStock}{recommendation.unit} · 예상 수요 {recommendation.demand}{recommendation.unit}</Text>
    <Text style={ui.muted}>수요 예측 기간 {recommendation.demandPeriod}</Text>
    <Text style={ui.muted}>{recommendation.supplier} · 매입가 {money(recommendation.unitCost)} · 납기 {recommendation.leadDays}일</Text>
    <Text style={ui.body}>{recommendation.reason}</Text>
    {recommendation.warning && <Notice>{recommendation.warning}</Notice>}
    <Button title="상품 재고 상세" secondary onPress={() => router.push({ pathname: '/products/[id]', params: { id: recommendation.productId } })} />
    {recommendation.draftId ? <Button title={`발주서 검토 · ${recommendation.draftId}`} onPress={() => router.push({ pathname: '/purchase-orders/[id]', params: { id: recommendation.draftId! } })} /> : <Button title={isMock ? "추천으로 초안 작성" : "초안 생성 연동 준비 중"} disabled={action.busy || !isMock} onPress={() => setConfirm(true)} />}
    {action.message && <Notice error={action.failed}>{action.message}</Notice>}
    <ConfirmDialog visible={confirm} title="추천으로 데모 초안을 만들까요?" text={`${recommendation.productName} ${recommendation.quantity}${recommendation.unit}\n예상 금액 ${money(cost)}\n초안만 생성하며 실제 발주나 승인은 수행하지 않습니다.`} confirmLabel="데모 초안 생성" busy={action.busy} onCancel={() => setConfirm(false)} onConfirm={create} />
  </Card>;
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
