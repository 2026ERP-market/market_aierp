import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, Notice, ResourceState, Screen } from '../../components/common/ui';
import { useAction } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { isMock, services } from '../../services';
const blank = { name: '', barcode: '', category: '', unit: '개', price: '' };
export default function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const action = useAction();
  const key = id ?? 'new';
  const [draft, setDraft] = useState<{ key: string; fields: Partial<typeof blank> }>({ key, fields: {} });
  const query = useResource(async signal => id ? services.products.get(id, signal) : null, id ?? 'new');
  const product = query.data;
  const initial = product ? { name: product.name, barcode: product.barcode, category: product.category, unit: product.unit, price: String(product.price) } : blank;
  const form = { ...initial, ...(draft.key === key ? draft.fields : {}) };
  function edit(field: keyof typeof blank, value: string) {
    setDraft(previous => ({ key, fields: { ...(previous.key === key ? previous.fields : {}), [field]: value } }));
  }
  async function save() {
    await action.run(async () => {
      if (!/^\d+$/.test(form.price)) throw new Error('판매가는 0 이상의 정수로 입력해 주세요.');
      await services.products.save({ name: form.name.trim(), barcode: form.barcode.trim(), category: form.category.trim(), unit: form.unit.trim(), price: Number(form.price) }, id);
    }, '데모 상품을 저장했어요. 재고 탭으로 돌아가면 새 목록이 표시됩니다.');
  }
  return <Screen title={id ? '상품 정보 수정' : '새 상품 등록'}><ResourceState {...query} hasData={!!query.data} retry={query.reload} /><Card><Notice>{isMock ? '데모 저장은 메모리에서만 유지됩니다. 재고 수량은 여기서 수정하지 않습니다.' : '서버 품목 마스터에 저장됩니다. 바코드는 서버 미지원, 재고 수량은 여기서 수정하지 않아요.'}</Notice>
    {(['name', 'barcode', 'category', 'unit', 'price'] as const).map(field => <Field key={field} label={{ name: '상품명', barcode: '바코드', category: '카테고리', unit: '수량 단위', price: '판매가 (원)' }[field]} value={form[field]} onChangeText={value => edit(field, value)} keyboardType={field === 'price' ? 'number-pad' : 'default'} />)}
    {action.message && <Notice error={action.failed}>{action.message}</Notice>}<Button title={action.busy ? '저장 중…' : isMock ? '데모 상품 저장' : '상품 저장'} disabled={action.busy || query.loading || !!query.error || Object.values(form).some(v => !v.trim())} onPress={save} />
  </Card></Screen>;
}
