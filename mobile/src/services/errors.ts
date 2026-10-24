export type ErrorCode = 'network' | 'forbidden' | 'unauthorized' | 'not_found' | 'conflict' | 'validation' | 'invalid_response' | 'timeout' | 'contract_pending' | 'server';
export class ServiceError extends Error {
  constructor(public code: ErrorCode, message: string) { super(message); this.name = 'ServiceError' }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.';
}
export function requireInteger(value: number, label = '수량') {
  if (!Number.isSafeInteger(value) || value < 0) throw new ServiceError('validation', `${label}은 0 이상의 정수로 입력해 주세요.`);
}
