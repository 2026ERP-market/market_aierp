import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, EmptyState, ResourceState, Screen } from '../../components/common/ui';
import { MetricCard, PurchaseOrderCard } from '../../components/cards';
import { RecommendationCard } from '../../components/cards/ReplenishmentCards';
import { useResource } from '../../hooks/useResource';
import { isMock, replenishmentService, services } from '../../services';
import { timestamp } from '../../utils/format';
import { ui } from '../../theme';
import { PosHomeActions, PosWorkQueue } from '../../components/pos/PosHomeActions';
import { PosWorkspace } from '../../components/pos/PosWorkspace';
export default function DashboardScreen() {
  const [showOverview, setShowOverview] = useState(false);
  const query = useResource(async signal => {
    const [summary, plan, inventory, orders] = await Promise.all([
      services.dashboard.get(signal), replenishmentService.get(signal), services.products.list(signal), services.purchases.list(signal),
    ]);
    return { summary, plan, inventory, orders };
  });
  const data = query.data;
  const waiting = data?.orders.filter(order => order.allowedActions.includes('approve')) ?? [];
  if (!showOverview) return <PosWorkspace data={data} loading={query.loading} error={query.error} onRefresh={query.reload} onOpenOverview={() => setShowOverview(true)} />;
  return <Screen variant="pos" title="매장 업무" subtitle="처리할 업무를 선택해 주세요." loading={query.loading} onRefresh={query.reload} action={<Button title="POS 화면" secondary onPress={() => setShowOverview(false)} />}>
    <ResourceState {...query} hasData={!!data} retry={query.reload} />
    {data && <>
      <View style={{ gap: 4 }}><Text style={[ui.body, { fontWeight: '700' }]}>{data.summary.store.name}</Text><Text style={ui.muted}>기준일 {data.summary.date} · 갱신 {timestamp(data.plan.updatedAt)}</Text></View>
      <PosWorkQueue pending={isMock ? waiting.length : null} stockout={data.summary.stockoutCount} expiring={data.summary.expiringCount} />
    </>}
    <PosHomeActions recommendationCount={data?.plan.recommendations.length} />
    {data && <>
      <Card title="✦ AI 발주 브리핑"><Text style={ui.body}>{data.plan.briefing}</Text><Button title="AI에게 발주 질문하기" secondary onPress={() => router.push('/agent')} /></Card>
      <View style={ui.row}><MetricCard label="! 과잉 위험" value={isMock ? `${data.plan.inventory.filter(item => item.overstockRisk).length}개` : "서버 미제공"} onPress={() => router.push({ pathname: '/inventory', params: { status: 'overstock' } })} /></View>
      <Text accessibilityRole="header" style={ui.heading}>오늘 검토할 보충 계획</Text>
      {data.plan.recommendations.map(recommendation => <RecommendationCard key={recommendation.id} recommendation={recommendation} onChanged={query.reload} />)}
      {!data.plan.recommendations.length && <EmptyState text="현재 검토할 발주 추천이 없어요." />}
      <Text accessibilityRole="header" style={ui.heading}>소비기한을 먼저 확인하세요</Text>
      {data.inventory.products.filter(product => product.risk.status === 'expiring').map(product => <Card key={product.id} title={product.name}><Badge label="! 소비기한 임박" tone="warning" /><Text style={ui.body}>{product.risk.reason}</Text><Button title="소비기한별 재고 확인" secondary onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })} /></Card>)}
      {!data.inventory.products.some(product => product.risk.status === 'expiring') && <Text style={ui.muted}>소비기한 위험 상품이 없습니다.</Text>}
      <Text accessibilityRole="header" style={ui.heading}>승인할 발주서</Text>
      {waiting.map(order => <PurchaseOrderCard key={order.id} order={order} />)}
      {!waiting.length && <Text style={ui.muted}>{isMock ? "현재 승인 검토를 기다리는 발주서가 없습니다." : "승인 대기 판정과 승인 작업은 연동 준비 중입니다."}</Text>}
    </>}
  </Screen>;
}
