import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Chips, EmptyState, Field, ResourceState, Screen } from '../../components/common/ui';
import { ProductListItem } from '../../components/cards';
import { useResource } from '../../hooks/useResource';
import { isMock, replenishmentService, services } from '../../services';
import { stockLabel } from '../../utils/format';
export default function InventoryScreen() {
  const params = useLocalSearchParams<{ status?: string }>();
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('all'); const [status, setStatus] = useState('all');
  const query = useResource(async signal => {
    const [inventory, plan] = await Promise.all([services.products.list(signal), replenishmentService.get(signal)]);
    return { ...inventory, planning: plan.inventory };
  });
  const products = query.data?.products ?? [];
  const selectedStatus = params.status || status;
  const filtered = products.filter(p => `${p.name} ${p.barcode}`.toLowerCase().includes(search.toLowerCase()) && (category === 'all' || p.category === category) && (selectedStatus === 'all' || (selectedStatus === 'overstock' ? query.data?.planning.some(item => item.productId === p.id && item.overstockRisk) : selectedStatus === 'risk' ? ['low', 'out'].includes(p.risk.status) : p.risk.status === selectedStatus)));
  return <Screen title="재고와 보충 현황" subtitle="현재 수량·입고 예정·소비기한을 함께 확인하세요." loading={query.loading} onRefresh={query.reload} action={<Button title="+ 상품 등록" onPress={() => router.push('/products/edit')} />}>
    <Field label="상품명 또는 바코드 검색" value={search} onChangeText={setSearch} placeholder="상품명, 바코드 입력" autoCorrect={false} />
    <Chips selected={category} onSelect={setCategory} values={[{ label: '전체 분류', value: 'all' }, ...Array.from(new Set(products.map(p => p.category))).map(c => ({ label: c, value: c }))]} />
    <Chips selected={selectedStatus} onSelect={value => { setStatus(value); router.setParams({ status: '' }) }} values={[{ label: '전체 상태', value: 'all' }, { label: '! 부족·품절', value: 'risk' }, { label: '! 과잉 위험', value: 'overstock' }, ...Object.entries(stockLabel).map(([value, label]) => ({ value, label }))]} />
    <ResourceState {...query} hasData={!!query.data} retry={query.reload} />
    {filtered.map(product => <ProductListItem key={product.id} product={product} planning={query.data?.planning.find(item => item.productId === product.id)} />)}
    {!query.loading && !query.error && !filtered.length && <EmptyState text={!isMock && selectedStatus === "overstock" ? "과잉 위험 판정은 서버에서 아직 제공하지 않습니다." : "검색어나 필터를 바꾸거나 상품을 등록해 주세요."} />}
    <Button title="보조 화면 · 판매 데이터 참고" secondary onPress={() => router.push('/sales')} />
  </Screen>;
}
