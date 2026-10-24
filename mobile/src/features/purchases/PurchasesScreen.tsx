import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Chips, EmptyState, Notice, ResourceState, Screen } from '../../components/common/ui';
import { PurchaseOrderCard } from '../../components/cards';
import { BudgetCard, RecommendationCard } from '../../components/cards/ReplenishmentCards';
import { useResource } from '../../hooks/useResource';
import { isMock, replenishmentService, services } from '../../services';
import { orderLabel } from '../../utils/format';
import { estimatedCost } from '../../utils/replenishment';
export default function PurchasesScreen() {
  const [status, setStatus] = useState('all'); const [supplier, setSupplier] = useState('all');
  const [view, setView] = useState('recommendations'); const params = useLocalSearchParams<{ view?: string }>(); const selectedView = params.view || view;
  const query = useResource(async signal => {
    const [orders, plan] = await Promise.all([services.purchases.list(signal), replenishmentService.get(signal)]);
    return { orders, plan };
  });
  const orders = query.data?.orders ?? []; const recommendations = query.data?.plan.recommendations ?? [];
  const filtered = orders.filter(o => (selectedView !== 'approval' || o.allowedActions.includes('approve')) && (status === 'all' || o.status === status) && (supplier === 'all' || o.supplier === supplier));
  const filteredRecommendations = recommendations.filter(r => supplier === 'all' || r.supplier === supplier);
  return <Screen title="발주 계획과 승인" subtitle="예측 수요와 입고 예정량을 확인하고 초안을 검토하세요." loading={query.loading} onRefresh={query.reload}>
    <Notice>AI 추천은 발주 확정이 아닙니다. 초안 저장과 승인을 구분하고, 입고 내역은 별도로 확인하세요.</Notice>
    <Chips selected={selectedView} onSelect={value => { setView(value); setStatus('all'); setSupplier('all'); router.setParams({ view: '' }) }} values={[{ value: 'recommendations', label: 'AI 추천' }, { value: 'approval', label: '승인 검토 대기' }, { value: 'orders', label: '발주·입고 내역' }]} />
    {selectedView !== 'recommendations' && <Chips selected={status} onSelect={setStatus} values={[{ value: 'all', label: '전체 상태' }, ...Object.entries(orderLabel).map(([value, label]) => ({ value, label }))]} />}
    <Chips selected={supplier} onSelect={setSupplier} values={[{ value: 'all', label: '전체 공급업체' }, ...Array.from(new Set([...orders.map(o => o.supplier), ...recommendations.map(r => r.supplier)])).map(s => ({ value: s, label: s }))]} />
    <ResourceState {...query} hasData={!!query.data} retry={query.reload} />
    {selectedView === 'recommendations' ? <>
      {query.data && <BudgetCard budget={query.data.plan.budget} estimatedCost={estimatedCost(recommendations)} label="추천안 전체 예상 금액" />}
      <Notice>추천안 금액은 연결된 기존 초안과 중복 합산하지 않습니다. 소비기한 위험·과잉재고·입고 예정 물량도 함께 검토하세요.</Notice>
      {filteredRecommendations.map(recommendation => <RecommendationCard key={recommendation.id} recommendation={recommendation} onChanged={query.reload} />)}
      {!query.loading && !query.error && !filteredRecommendations.length && <EmptyState text="해당 조건의 발주 추천이 없습니다." />}
    </> : <>
      {filtered.map(order => <PurchaseOrderCard key={order.id} order={order} />)}
      {!query.loading && !query.error && !filtered.length && <EmptyState text={!isMock && selectedView === "approval" ? "승인 대기 판정은 서버 계약 협의 후 연결합니다. 발주·입고 내역을 이용해 주세요." : "해당 조건의 발주서가 없습니다."} />}
    </>}
  </Screen>;
}
