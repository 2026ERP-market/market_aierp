import { ServiceError } from '../errors';
type TokenProvider = () => Promise<string | null>;
export type ResponseDecoder<T> = (payload: unknown) => T;
// API 명세 확정 후 어댑터에서 사용합니다. 인증 서버/토큰 저장소는 구현하지 않습니다.
export function createHttpClient(baseUrl: string, tokenProvider: TokenProvider = async () => null, timeoutMs = 12000) {
  return async function request<T>(path: string, decode: ResponseDecoder<T>, init: RequestInit = {}): Promise<T> {
    if (!/^https?:\/\//.test(baseUrl)) throw new ServiceError('validation', 'API 서버 주소를 확인해 주세요.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    let timedOut = false;
    init.signal?.addEventListener('abort', abort, { once: true });
    if (init.signal?.aborted) abort();
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs);
    try {
      const token = await tokenProvider();
      const headers = new Headers(init.headers);
      headers.set('Accept', 'application/json');
      if (init.body) headers.set('Content-Type', 'application/json');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, { ...init, headers, signal: controller.signal });
      if (!response.ok) {
        const codes = { 400: 'validation', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 422: 'validation' } as const;
        const messages = { 400: '입력값을 확인해 주세요.', 401: '로그인이 필요합니다.', 403: '이 작업의 권한이 없습니다.', 404: '데이터를 찾지 못했어요.', 409: '데이터가 변경되었습니다. 새로고침해 주세요.', 422: '입력 형식을 확인해 주세요.' } as const;
        const status = response.status as keyof typeof codes;
        throw new ServiceError(codes[status] ?? 'server', messages[status] ?? '서버가 요청을 처리하지 못했어요.');
      }
      // 공식 API 스키마가 확정되면 각 어댑터가 런타임 검증기를 전달합니다.
      // JSON을 T로 단언하거나, 검증 실패를 Mock 데이터로 대체하지 않습니다.
      try {
        const payload: unknown = response.status === 204 ? undefined : await response.json();
        return decode(payload);
      } catch {
        throw new ServiceError('invalid_response', '서버 응답 형식이 올바르지 않아요. 담당자에게 확인해 주세요.');
      }
    } catch (error) {
      if (timedOut) throw new ServiceError('timeout', '응답이 늦어지고 있어요. 다시 시도해 주세요.');
      if (controller.signal.aborted || error instanceof ServiceError) throw error;
      throw new ServiceError('network', '서버에 연결할 수 없어요. 네트워크와 서버 주소를 확인해 주세요.');
    } finally { clearTimeout(timer); init.signal?.removeEventListener('abort', abort) }
  };
}
