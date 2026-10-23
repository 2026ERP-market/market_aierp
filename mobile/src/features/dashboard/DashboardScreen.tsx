import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, EmptyState, ResourceState, Screen } from '../../components/common/ui';
import { MetricCard, PurchaseOrderCard } from '../../components/cards';
import { RecommendationCard } from '../../components/cards/ReplenishmentCards';
import { useResource } from '../../hooks/useResource';
import { replenishmentService, services } from '../../services';
import { timestamp } from '../../utils/format';
import { ui } from '../../theme';
export default function DashboardScreen() {
  const query = useResource(async signal => {
    const [summary, plan, inventory, orders] = await Promise.all([
      services.dashboard.get(signal), replenishmentService.get(signal), services.products.list(signal), services.purchases.list(signal),
    ]);
    return { summary, plan, inventory, orders };
  });
  const data = query.data;
  const waiting = data?.orders.filter(order => order.allowedActions.includes('approve')) ?? [];
  return <Screen title="오늘의 발주를 준비하세요" subtitle="재고를 확인하고, 추천을 검토한 뒤 승인하세요." loading={query.loading} onRefresh={query.reload}>
    <ResourceState {...query} hasData={!!data} retry={query.reload} />
    {data && <>
      <View style={{ gap: 6 }}><Text style={ui.heading}>{data.summary.store.name}</Text><Text style={ui.muted}>기준일 {data.summary.date} · 갱신 {timestamp(data.plan.updatedAt)}</Text></View>
      <View style={[ui.row, { alignItems: 'stretch' }]}><MetricCard label="오늘 발주 검토" value={`${data.plan.recommendations.length}개 상품`} onPress={() => router.push('/purchases')} /><MetricCard label="승인 검토 대기" value={`${waiting.length}건`} onPress={() => router.push({ pathname: '/purchases', params: { view: 'approval' } })} /></View>
      <Card title="✦ AI 발주 브리핑"><Text style={ui.body}>{data.plan.briefing}</Text><Button title="AI에게 발주 질문하기" secondary onPress={() => router.push('/agent')} /></Card>
      <View style={[ui.row, { alignItems: 'stretch' }]}><MetricCard label="! 부족·품절 위험" value={`${data.summary.stockoutCount}개`} onPress={() => router.push({ pathname: '/inventory', params: { status: 'risk' } })} /><MetricCard label="! 소비기한 위험" value={`${data.summary.expiringCount}개`} onPress={() => router.push({ pathname: '/inventory', params: { status: 'expiring' } })} /><MetricCard label="! 과잉 위험" value={`${data.plan.inventory.filter(item => item.overstockRisk).length}개`} onPress={() => router.push({ pathname: '/inventory', params: { status: 'overstock' } })} /></View>
      <Text accessibilityRole="header" style={ui.heading}>오늘 검토할 보충 계획</Text>
      {data.plan.recommendations.map(recommendation => <RecommendationCard key={recommendation.id} recommendation={recommendation} onChanged={query.reload} />)}
      {!data.plan.recommendations.length && <EmptyState text="현재 검토할 발주 추천이 없어요." />}
      <Text accessibilityRole="header" style={ui.heading}>소비기한을 먼저 확인하세요</Text>
      {data.inventory.products.filter(product => product.risk.status === 'expiring').map(product => <Card key={product.id} title={product.name}><Badge label="! 소비기한 임박" tone="warning" /><Text style={ui.body}>{product.risk.reason}</Text><Button title="소비기한별 재고 확인" secondary onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })} /></Card>)}
      {!data.inventory.products.some(product => product.risk.status === 'expiring') && <Text style={ui.muted}>소비기한 위험 상품이 없습니다.</Text>}
      <Text accessibilityRole="header" style={ui.heading}>승인할 발주서</Text>
      {waiting.map(order => <PurchaseOrderCard key={order.id} order={order} />)}
      {!waiting.length && <Text style={ui.muted}>현재 승인 검토를 기다리는 발주서가 없습니다.</Text>}
    </>}
  </Screen>;
}
