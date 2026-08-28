import type { HouseholdId } from '../types/dashboard';
import type { HistoryPeriod, UsageHistoryData } from '../types/history';
export interface HistoryService {
  getHistory(
    householdId: HouseholdId,
    period: HistoryPeriod,
  ): Promise<UsageHistoryData>;
}
