import type { Services } from './contracts';
import { ServiceError } from './errors';
import { createMockServices } from './mock';
import type { ReplenishmentService } from './replenishment';
export const dataSource = process.env.EXPO_PUBLIC_DATA_SOURCE ?? 'mock';
export const isMock = dataSource === 'mock';
export const mockServices = createMockServices();
const pending = async (): Promise<never> => { throw new ServiceError('contract_pending', '실제 API 명세·인증 방식이 아직 확정되지 않았습니다. 실제 연결과 저장은 차단되어 있어요. mock 모드에서 화면을 확인하세요.') };
// 공식 명세 없이 URL이나 서버 업무 규칙을 임의로 확정하지 않습니다.
const liveServices: Services = {
  dashboard: { get: pending }, sales: { get: pending },
  products: { list: pending, get: pending, save: pending }, inventory: { count: pending },
  purchases: { list: pending, get: pending, save: pending, approve: pending }, agent: { send: pending },
};
export const services: Services = isMock ? mockServices : liveServices;
export const replenishmentService: ReplenishmentService = isMock ? mockServices.replenishment : { get: pending, createDraft: pending };
