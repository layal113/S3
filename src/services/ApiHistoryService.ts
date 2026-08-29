import { apiEndpoints } from '../config/apiEndpoints';
import { env } from '../config/env';
import type { HouseholdId } from '../types/dashboard';
import type { HistoryPeriod, UsageHistoryData } from '../types/history';
import type { HistoryService } from './HistoryService';

export class ApiHistoryService implements HistoryService {
  async getHistory(
    householdId: HouseholdId,
    period: HistoryPeriod,
  ): Promise<UsageHistoryData> {
    const url = `${env.apiBaseUrl}${apiEndpoints.usageHistory(householdId)}?period=${period}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`History HTTP status ${response.status}`);
    }
    return response.json() as Promise<UsageHistoryData>;
  }
}
