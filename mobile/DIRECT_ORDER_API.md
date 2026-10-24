# AI 추천에서 직접 발주 — 구현 및 API 인계

## 백엔드 작업 시작

이 프론트엔드는 `origin/feat/direct-ai-order`로 공유합니다. 최신 원격 정보를 받은 뒤 별도 백엔드 작업 브랜치를 만들어 시작하세요. 아래 로컬 브랜치가 이미 있으면 덮어쓰지 말고 다른 이름을 사용하세요.

```bash
git fetch origin
git switch --no-track -c feat/backend-direct-ai-order origin/feat/direct-ai-order
```

현재 UI와 아래 개별 발주 계약을 먼저 확인하고 요청/응답을 합의한 뒤 서버를 구현해 주세요. 구현 후 접속 가능한 서버 주소·OpenAPI·실제 DB 테스트 결과를 공유하면 프론트의 capability 및 어댑터를 연결해 함께 검증합니다. UI에서 비활성화를 해제하는 것만으로 기존 공급업체 일괄 발행 API를 호출하지 마세요. 자동 발주·토글은 이번 작업에 포함하지 않으며 main에 직접 push/merge하지 마세요.

## 적용 범위와 현재 상태

Expo mobile/만 수정합니다. 루트 src/, backend/, DB, 인증, 예측/LLM 코드는 변경하지 않습니다. 기준 브랜치는 origin/feat/pos-ui-backend의 dffac0d이며 작업 브랜치는 feat/direct-ai-order입니다.

새 흐름은 **AI 추천 → 최종 수량 수정 → 발주하기 / 발주 안 함 → 발주 내역 → 기존 입고 처리**입니다. 별도 초안 작성 화면 이동, 자동 발주, 자동화 토글, 예약 실행은 추가하지 않습니다.

## 재사용한 실제 API

- 추천: GET /api/v1/purchases/recommend?warehouse_id=WH-ASAN
- 거절: POST /api/v1/purchases/recommend/{rec_id}/action, JSON {"action":"reject"}
- 기존 상품 저장/수정, 실사, 재고/발주 조회, AI 질문, 입고 등록 어댑터 유지.

거절 전 추천 ID·상품 ID·매장·draft 상태를 확인하고, 성공 응답의 status/rec_id/new_status를 검증합니다. 이미 rejected라면 서버 조회 결과를 근거로 완료 처리합니다. 실패 시 입력과 상태를 유지하고 같은 버튼으로 재시도합니다. 프론트 사전 조회는 서버의 권한/동시성 검증을 대체하지 않습니다.

## 실제 개별 발주가 준비 중인 이유

기존 createDraft는 추천을 approve한 후 POST /purchases/orders?supplier_id=...로 발행합니다. 서버는 **해당 공급업체의 승인된 추천 전체**를 포함합니다. 선택 추천 1개만 발주한다는 계약이 없고 modified_qty는 recommended_qty를 덮어씁니다. 두 POST 사이의 실패·응답 유실·다른 기기의 동시 요청도 원자적으로 처리할 수 없습니다.

새 API 모드의 개별 발주는 capability=false로 비활성화하고 이유를 화면에 표시합니다. placeOrder를 직접 호출해도 contract_pending으로 차단하며 네트워크 요청을 보내지 않습니다. 기존 공급사 일괄 발행을 상품 하나의 발주처럼 호출하거나 존재하지 않는 endpoint를 가정하지 않습니다.

## 백엔드 요청 계약 — 제안, 아직 구현된 API가 아님

기존 endpoint 확장 또는 새 endpoint 중 어떤 방식을 사용할지 먼저 명세를 확정해 주세요. 선택 추천 하나에 대해 최종 수량을 반영하고 발주서를 생성하는 원자적 명령이 필요합니다. 프론트에는 확정되지 않은 URL을 넣지 않습니다.

요청 필드 제안(숫자는 명세 설명용 예시):

```json
{
  "recommendation_id": "서버 추천 ID",
  "item_id": "서버 상품 ID",
  "ai_recommended_qty": 30,
  "final_qty": 12,
  "idempotency_key": "동일 결정의 재시도에 동일한 키"
}
```

응답 요구:

- 추천 ID, 상품 ID, 원래 AI 추천 수량, 최종 발주 수량, 처리 상태 ordered.
- 생성된 발주 ID와 기존 PurchaseOrderResponse 호환 품목·수량·금액·상태.
- 선택한 품목만 포함한다는 보장 또는 명시적 포함 범위.
- 외부 공급업체 전송 여부. 내부 발주 발행을 외부 발송 완료로 표시하지 않기.

서버 처리 요구:

1. 양의 정수 수량, 상품/추천/매장 관계, 사용자 권한을 검증합니다.
2. 원래 AI 추천 수량과 사용자 최종 수량을 별도로 기록합니다. 클라이언트의 가격/원본 수량을 신뢰하지 않고 서버 기록과 비교합니다.
3. ordered/rejected 추천의 잘못된 재처리를 거부합니다.
4. 발주 생성과 추천 상태 변경을 한 트랜잭션으로 처리합니다.
5. 멱등 키 재시도와 동시 요청의 중복 생성을 막고, 응답 유실 후 결과 조회 방법을 제공합니다.
6. 발주만으로 현재 재고를 늘리지 않습니다. 입고 예정과 실제 입고를 구분합니다.
7. 추천 조회에도 상태·원래 AI 수량·최종 수량·연결 발주 ID를 제공해 앱 재시작 후 상태를 복원합니다.
8. 기존 거절 API도 서버에서 이미 발주된 추천·매장 권한·동시 발주와의 충돌을 검증합니다.

## 프론트 구조와 남긴 기존 기능

- services/recommendationDecisions.ts: 원본 추천 수량과 최종 수량을 구분한 타입, 양의 정수 검사, capability 인터페이스.
- RecommendationDecisionForm: 목록·POS·홈 요약·상품 상세에서 재사용. 상태/수량/근거/금액/발주·거절/오류/내역 링크 표시.
- services/mock/index.ts: 고정 fixture의 명시적 메모리 데모. 원본 수량 보존, ordered 내역 생성, 동시·중복 결정 차단, 거절·실패·재시도 지원. API 실패 시 이 Mock으로 자동 전환하지 않습니다.
- AI recommendationId 액션은 추천 입력 화면만 열고 주문을 생성하지 않습니다. AI 질문 처리와 서버 분석은 보존합니다.

추천 CTA와 POS 패널의 초안 생성·저장·승인 단계를 제거했습니다. /purchase-orders/[id]와 OrderScreen은 기존 발주 내역·입고·과거 초안 조회에 사용하므로 삭제하지 않습니다. 기존 승인 대기 탭은 '기존 승인 대기'로 구분합니다. ReplenishmentService.createDraft와 기존 purchases.save/approve/receive 계약은 호환성과 기존 테스트를 위해 유지하지만 새 추천 결정에서 호출하지 않습니다.

Mock의 DEMO-001 초안과 DEMO-002 일부입고 기록은 보존합니다. 우유 직접 발주는 연관된 기존 초안을 최종 수량의 ordered 내역으로 전환하고, 식빵은 새 내역을 생성합니다. 거절은 기존 발주를 삭제/취소하지 않습니다. 신규 발주 직후 현재 재고는 유지하고 데모 입고 예정량에 반영합니다. 기존 Mock 입고 구현은 상태/내역 샘플이며 실제 DB·로트 재고 반영 검증을 대신하지 않습니다.

## 실행과 검증

기본 mock에서 mobile/의 npm run web -- --port 8081을 실행합니다. 홈에서 상품 선택 또는 /purchases?view=recommendations에서 추천 카드를 확인합니다. 우유 추천 30을 12로 수정해 발주하면 추천 30·최종 12·금액 25,200원의 샘플 내역을 확인하고, 현재 재고 8은 유지됩니다. 전체 페이지 새로고침으로 JS 메모리가 초기화되면 샘플도 초기화됩니다.

설정의 네트워크/권한 오류와 정상 상태를 전환해 오류 후 입력 유지·재시도를 재현합니다. API 모드는 실제 서버가 필요하고 개별 발주는 위 계약 구현 전까지 비활성화됩니다. 실제 서버 거절 저장·주문 발행·입고/DB 반영·Android/iOS 실기기 동작은 별도 검증 대상입니다.

최종 검증은 TypeScript·ESLint·서비스 테스트 32개·Expo 웹 export·Android Hermes 번들 생성 모두 통과했습니다. 브라우저에서 직접 발주/거절, 원본·최종 수량, 중복 클릭, 오류/재시도, 내역·기존 입고 UI와 입고 오류 표시, AI 비자동 실행, 320~1280px 하단 버튼 노출을 확인했습니다. 백엔드 파일/의존성 변경과 commit/push는 없습니다.
