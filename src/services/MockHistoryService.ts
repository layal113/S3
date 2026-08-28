import { simulatedHistory } from '../data/simulatedHistory';
import type { HouseholdId } from '../types/dashboard';
import type { HistoryPeriod, UsageHistoryData } from '../types/history';
import type { HistoryService } from './HistoryService';
export class MockHistoryService implements HistoryService {
  async getHistory(
    _householdId: HouseholdId,
    period: HistoryPeriod,
  ): Promise<UsageHistoryData> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return simulatedHistory[period];
  }
}
