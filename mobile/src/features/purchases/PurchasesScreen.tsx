import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Button, Chips, EmptyState, Notice, ResourceState, Screen } from '../../components/common/ui';
import { PurchaseOrderCard } from '../../components/cards';
import { BudgetCard, RecommendationCard } from '../../components/cards/ReplenishmentCards';
import { useResource } from '../../hooks/useResource';
import { isMock, replenishmentService, services } from '../../services';
import { orderLabel } from '../../utils/format';
import { estimatedCost } from '../../utils/replenishment';
export default function PurchasesScreen() {
  const [status, setStatus] = useState('all'); const [supplier, setSupplier] = useState('all');
  const [view, setView] = useState('recommendations'); const params = useLocalSearchParams<{ view?: string; recommendationId?: string }>(); const selectedView = params.view || view;
  const query = useResource(async signal => {
    const [orders, plan] = await Promise.all([services.purchases.list(signal), replenishmentService.get(signal)]);
    return { orders, plan };
  });
  const orders = query.data?.orders ?? []; const recommendations = query.data?.plan.recommendations ?? [];
  const filtered = orders.filter(o => (selectedView !== 'approval' || o.allowedActions.includes('approve')) && (status === 'all' || o.status === status) && (supplier === 'all' || o.supplier === supplier));
  const filteredRecommendations = recommendations.filter(r => (supplier === 'all' || r.supplier === supplier) && (!params.recommendationId || r.id === params.recommendationId));
  return <Screen title="AI 스마트 발주" subtitle="추천 수량을 수정한 뒤 발주 여부를 직접 결정하세요." loading={query.loading} onRefresh={query.reload}>
    <Notice>별도의 초안 작성 없이 추천 카드에서 결정합니다. 발주만으로 현재 재고가 늘어나지 않으며 입고는 발주 내역에서 처리합니다. 자동 발주는 사용하지 않습니다.</Notice>
    <Chips selected={selectedView} onSelect={value => { setView(value); setStatus('all'); setSupplier('all'); router.setParams({ view: '', recommendationId: '' }) }} values={[{ value: 'recommendations', label: 'AI 추천' }, { value: 'orders', label: '발주·입고 내역' }, { value: 'approval', label: '기존 승인 대기' }]} />
    {!!params.recommendationId && <Button title="전체 추천 보기" secondary onPress={() => router.setParams({ recommendationId: '' })} />}
    {selectedView !== 'recommendations' && <Chips selected={status} onSelect={setStatus} values={[{ value: 'all', label: '전체 상태' }, ...Object.entries(orderLabel).map(([value, label]) => ({ value, label }))]} />}
    <Chips selected={supplier} onSelect={setSupplier} values={[{ value: 'all', label: '전체 공급업체' }, ...Array.from(new Set([...orders.map(o => o.supplier), ...recommendations.map(r => r.supplier)])).map(s => ({ value: s, label: s }))]} />
    <ResourceState {...query} hasData={!!query.data} retry={query.reload} />
    {selectedView === 'recommendations' ? <>
      {query.data && <BudgetCard budget={query.data.plan.budget} estimatedCost={estimatedCost(recommendations.filter(item => item.status === 'pending'))} label="검토 대기 추천 예상 금액" />}
      <Notice>추천 수량 기준 참고 금액입니다. 카드에서 입력한 최종 수량과 기존 입고 예정 물량을 확인하세요.</Notice>
      {filteredRecommendations.map(recommendation => <RecommendationCard key={recommendation.id} recommendation={recommendation} onChanged={query.reload} loading={query.loading} />)}
      {!query.loading && !query.error && !filteredRecommendations.length && <EmptyState text="해당 조건의 발주 추천이 없습니다." />}
    </> : <>
      {filtered.map(order => <PurchaseOrderCard key={order.id} order={order} />)}
      {!query.loading && !query.error && !filtered.length && <EmptyState text={!isMock && selectedView === "approval" ? "승인 대기 판정은 서버 계약 협의 후 연결합니다. 발주·입고 내역을 이용해 주세요." : "해당 조건의 발주서가 없습니다."} />}
    </>}
  </Screen>;
}
