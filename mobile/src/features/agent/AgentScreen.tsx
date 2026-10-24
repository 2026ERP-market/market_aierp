import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, ConfirmDialog, Field, Notice, Screen } from '../../components/common/ui';
import { useAction } from '../../hooks/useAction';
import { isMock, replenishmentService, services } from '../../services';
import type { AgentMessage } from '../../types/domain';
import { colors, ui } from '../../theme';
import { resolvePlanningAction } from './navigation';
export default function AgentScreen() {
  const [messages, setMessages] = useState<AgentMessage[]>([]); const [input, setInput] = useState(''); const [retry, setRetry] = useState('');
  const action = useAction(); const controller = useRef<AbortController | null>(null);
  const [draftRequest, setDraftRequest] = useState<string>();
  useEffect(() => () => controller.current?.abort(), []);
  async function send(question: string, retrying = false) {
    if (!question.trim()) return;
    await action.run(async () => {
      if (!retrying) { setMessages(old => [...old, { id: `user-${Date.now()}`, role: 'user', content: question, state: 'success' }]); setInput('') }
      setRetry(question);
      const next = new AbortController(); controller.current = next;
      const reply = await services.agent.send(question, next.signal);
      if (!next.signal.aborted) { setMessages(old => [...old, reply]); setRetry('') }
    }, '');
  }
  function openAction(value: unknown) {
    const destination = resolvePlanningAction(value);
    if (!destination) return;
    if (destination.kind === 'order') router.push({ pathname: '/purchase-orders/[id]', params: { id: destination.id } });
    else if (destination.kind === 'product') router.push({ pathname: '/products/[id]', params: { id: destination.id } });
    else if (destination.kind === 'recommendation') setDraftRequest(destination.id);
    else if (destination.kind === 'list') router.push(`/${destination.target}`);
  }
  async function createDraft() {
    if (!draftRequest) return;
    let id: string | undefined;
    const ok = await action.run(async () => { id = (await replenishmentService.createDraft(draftRequest)).id }, '');
    setDraftRequest(undefined);
    if (ok && id) router.push({ pathname: '/purchase-orders/[id]', params: { id } });
  }
  return <Screen title="AI 발주 도우미" subtitle="품절 위험과 적정 보충 수량을 함께 검토하세요.">
    <Notice>AI 추천은 검토를 돕는 정보입니다. 주문이나 재고를 자동으로 변경하지 않아요.</Notice>
    <Card title="이렇게 물어보세요">{['재고가 부족해질 상품을 알려줘', '우유 발주 수량을 추천해 줘', '과잉재고 위험을 설명해 줘', '식빵 발주서 초안을 만들어 줘'].map(question => <Button key={question} title={question} secondary disabled={action.busy || !!retry} onPress={() => send(question)} />)}</Card>
    {messages.map(message => <View key={message.id} style={[ui.card, { alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', width: '95%', backgroundColor: message.role === 'user' ? colors.primarySoft : colors.surface }]}><Text style={[ui.muted, { fontWeight: '700' }]}>{message.role === 'user' ? '나' : '✦ AI 도우미'}{message.state !== 'success' ? ' · 추가 확인 필요' : ''}</Text><Text selectable style={ui.body}>{message.content}</Text>{message.cards?.map((card, index) => <Card key={index} title={card.title}><Text style={ui.body}>{card.text}</Text><Button title={card.action.label} secondary disabled={action.busy || !resolvePlanningAction(card.action)} onPress={() => openAction(card.action)} /></Card>)}</View>)}
    {action.busy && <Notice>응답을 기다리고 있어요…</Notice>}
    {action.failed && action.message && <Notice error>{action.message}</Notice>}
    {!!retry && !action.busy && <Button title="이 질문 다시 시도" secondary onPress={() => send(retry, true)} />}
    <Card><Field label="재고·발주 질문" value={input} onChangeText={setInput} placeholder="예: 내일 우유를 몇 개 발주하면 좋을까?" multiline maxLength={2000} editable={!action.busy} /><Button title={action.busy ? '응답 생성 중…' : '질문 보내기'} disabled={action.busy || !input.trim() || !!retry} onPress={() => send(input.trim())} />{retry && !action.busy ? <Button title="실패한 질문 취소" secondary onPress={() => setRetry('')} /> : null}</Card>
    <ConfirmDialog visible={!!draftRequest} title="추천으로 데모 초안을 만들까요?" text="AI 카드의 상품과 추천 근거를 확인해 주세요. 초안만 생성하며 실제 발주·승인·입고는 수행하지 않습니다." confirmLabel="데모 초안 생성" busy={action.busy} onCancel={() => setDraftRequest(undefined)} onConfirm={createDraft} />
    {!isMock && <Notice>실제 AI 에이전트(서버 LLM)에 연결되어 ERP 데이터로 응답합니다.</Notice>}
  </Screen>;
}
