import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { Product } from '../../types/domain';
import type { ReplenishmentPlan } from '../../services/replenishment';
import { money, number } from '../../utils/format';
import { c, counter } from './counterStyles';

interface Props {
  products: Product[]; plan?: ReplenishmentPlan; selectedId?: string; width: number; compact?: boolean;
  onSelect: (id: string) => void; onRefresh: () => void; onOpenOverview: () => void;
}

export function PosCatalog({ products, plan, selectedId, width, compact = false, onSelect, onRefresh, onOpenOverview }: Props) {
  const [category, setCategory] = useState('전체 상품');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  const [expanded, setExpanded] = useState(false);
  const availableWidth = measuredWidth ?? width;
  const categories = ['전체 상품', 'AI 추천', ...new Set(products.map(product => product.category))];
  const filtered = products.filter(product => (category === '전체 상품' || (category === 'AI 추천' ? plan?.recommendations.some(item => item.productId === product.id) : product.category === category)) && `${product.name} ${product.barcode}`.toLowerCase().includes(search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const currentPage = Math.min(page, pages - 1);
  const columns = availableWidth >= 720 ? 6 : availableWidth >= 550 ? 4 : availableWidth >= 430 ? 3 : 2;
  const horizontalPadding = compact ? 12 : 18;
  const tileWidth = (availableWidth - horizontalPadding * 2 - (columns - 1) * 8) / columns;
  const options = [
    { label: 'AI 발주 추천', run: () => router.push({ pathname: '/purchases', params: { view: 'recommendations' } }) },
    { label: '재고 확인', run: () => router.push('/inventory') },
    { label: '입고 내역', run: () => router.push({ pathname: '/purchases', params: { view: 'orders' } }) },
    { label: '소비기한 관리', run: () => router.push({ pathname: '/inventory', params: { status: 'expiring' } }) },
    { label: '과잉 위험', run: () => router.push({ pathname: '/inventory', params: { status: 'overstock' } }) },
    { label: '승인 대기', run: () => router.push({ pathname: '/purchases', params: { view: 'approval' } }) },
    { label: '상품 등록', run: () => router.push('/products/edit') },
    { label: 'AI 도우미', run: () => router.push('/agent') },
    { label: '새로고침', run: onRefresh },
    { label: '업무 요약', run: onOpenOverview },
    { label: '설정', run: () => router.push('/settings') },
    { label: '발주 목록', run: () => router.push('/purchases') },
  ];
  const optionColumns = !compact && availableWidth >= 650 ? 6 : 3;
  const visibleOptions = compact && !expanded ? options.slice(0, 6) : options;
  const header = <>
    <View style={[c.categories, compact && c.categoriesCompact]}><ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {categories.map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: category === value }} onPress={() => { setCategory(value); setPage(0) }} style={[c.category, compact && c.categoryCompact, category === value && c.categoryActive]}><Text style={[c.categoryText, compact && c.categoryTextCompact, category === value && c.categoryTextActive]}>{value}</Text></Pressable>)}
    </ScrollView></View>
    <View style={[c.searchRow, compact && c.searchRowCompact]}><Text style={{ color: counter.muted, fontSize: 20 }}>⌕</Text><TextInput accessibilityLabel="상품명 또는 바코드 검색" placeholder="상품명 또는 바코드 검색" placeholderTextColor={counter.muted} value={search} onChangeText={value => { setSearch(value); setPage(0) }} style={c.search} />{search !== '' && <Pressable accessibilityRole="button" accessibilityLabel="검색 지우기" onPress={() => setSearch('')} style={c.iconButton}><Text style={{ color: counter.muted, fontSize: 20 }}>×</Text></Pressable>}</View>
  </>;
  const footer = <>
    {(!compact || pages > 1 || expanded) && <View style={[c.utility, compact && { paddingHorizontal: 12 }]}><View style={{ flexDirection: 'row', gap: 14 }}><Pressable accessibilityRole="button" onPress={() => router.push('/inventory')} style={c.utilityLink}><Text style={c.utilityText}>✎ 상품 관리</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push('/products/edit')} style={c.utilityLink}><Text style={c.utilityText}>⊕ 상품 추가</Text></Pressable></View><View style={c.paging}><Text style={c.pageText}>{currentPage + 1} / {pages}</Text>{[-1, 1].map(direction => <Pressable key={direction} accessibilityRole="button" accessibilityLabel={direction < 0 ? '이전 상품 페이지' : '다음 상품 페이지'} disabled={currentPage + direction < 0 || currentPage + direction >= pages} onPress={() => setPage(currentPage + direction)} style={[c.iconButton, (currentPage + direction < 0 || currentPage + direction >= pages) && { opacity: 0.3 }]}><Text style={{ color: '#64707C', fontSize: 25 }}>{direction < 0 ? '‹' : '›'}</Text></Pressable>)}</View></View>}
    <View style={[c.options, compact && c.optionsCompact]}><Text style={c.optionsHeading}>자주 쓰는 업무</Text><View style={c.optionsGrid}>{visibleOptions.map((option, index) => <Pressable accessibilityRole="button" key={option.label} onPress={option.run} style={[c.option, { width: (availableWidth - horizontalPadding * 2 - (optionColumns - 1) * 5) / optionColumns }, (index === 5 || index === 11) && c.optionDark]}><Text style={[c.optionText, (index === 5 || index === 11) && { color: '#fff' }]}>{option.label}</Text></Pressable>)}</View>
      {compact && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={c.moreActions}><Text style={c.utilityText}>{expanded ? '추가 업무 접기 ∧' : '추가 업무 6개 보기 ∨'}</Text></Pressable>}
    </View>
  </>;
  return <View style={c.catalog} onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}>
    {!compact && header}
    <FlatList key={columns} style={{ flex: 1, minHeight: 0 }} data={filtered.slice(currentPage * 24, (currentPage + 1) * 24)} numColumns={columns} keyExtractor={item => item.id} contentContainerStyle={compact ? c.catalogScrollCompact : c.grid} columnWrapperStyle={{ gap: 8, ...(compact ? { paddingHorizontal: horizontalPadding } : {}) }} ListHeaderComponent={compact ? header : undefined} ListFooterComponent={compact ? footer : undefined} keyboardShouldPersistTaps="handled" renderItem={({ item }) => {
      const selected = selectedId === item.id;
      const out = item.risk.status === 'out';
      const overstock = plan?.inventory.find(value => value.productId === item.id)?.overstockRisk;
      const white = selected || out;
      const status = item.risk.status === 'out' ? '품절' : item.risk.status === 'low' ? '재고 부족' : item.risk.status === 'expiring' ? '소비기한 주의' : overstock ? '과잉 위험' : item.risk.status === 'needs_check' ? '확인 필요' : '정상 재고';
      return <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${status}, 재고 ${item.quantity}${item.unit}`} accessibilityState={{ selected }} onPress={() => onSelect(item.id)} style={({ pressed }) => [c.tile, compact && c.tileCompact, { width: tileWidth, opacity: pressed ? 0.8 : 1 }, overstock && c.tileOverstock, item.risk.status === 'expiring' && c.tileExpiry, out && c.tileOut, selected && c.tileSelected]}>
        <View style={{ gap: compact ? 3 : 5 }}><Text numberOfLines={2} style={[c.tileName, compact && c.tileNameCompact, white && { color: '#fff' }]}>{item.name}</Text><Text style={[c.tileMeta, { color: white ? '#F0F5FA' : '#505C68' }]}>{status} · {number(item.quantity)}{item.unit}</Text></View><Text style={[c.tilePrice, { color: white ? '#F0F5FA' : '#505C68' }]}>{money(item.purchasePrice)}</Text>
      </Pressable>;
    }} ListEmptyComponent={<View style={c.empty}><Text style={c.emptyTitle}>{products.length ? '검색 결과가 없어요' : '등록된 상품이 없습니다'}</Text><Text style={c.emptyText}>분류와 검색어를 확인하거나 재고 화면에서 상품을 등록하세요.</Text></View>} />
    {!compact && footer}
  </View>;
}
