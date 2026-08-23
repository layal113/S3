import type { HistoryPeriod, UsageHistoryData } from '../types/history';
export interface HistoryService {
  getHistory(period: HistoryPeriod): Promise<UsageHistoryData>;
}
