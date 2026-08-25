import { env } from '../config/env';
import { apiEndpoints } from '../config/apiEndpoints';
import { simulatedHouseholds } from '../data/simulatedDashboard';
import type {
  DashboardData,
  HouseholdId,
  HouseholdOption,
} from '../types/dashboard';
import type { DashboardService } from './DashboardService';

export class ApiDashboardService implements DashboardService {
  getHouseholds(): HouseholdOption[] {
    return simulatedHouseholds;
  }

  async getDashboard(householdId: HouseholdId): Promise<DashboardData> {
    const url = `${env.apiBaseUrl}${apiEndpoints.dashboard(householdId)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: DashboardData = await response.json();
      return data;
    } catch (error) {
      console.warn(`[ApiDashboardService] Failed to fetch live dashboard from ${url}:`, error);
      throw error;
    }
  }

  async triggerSimulation(householdId: HouseholdId = 'high-ac-home'): Promise<DashboardData> {
    const simUrl = `${env.apiBaseUrl}/simulate-usage`;
    try {
      // 1. Trigger simulation
      const simRes = await fetch(simUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_id: householdId,
          duration_minutes: 30,
          interval_seconds: 60,
        }),
      });
      const simData = await simRes.json();

      // 2. Chained call: feed simulated readings directly into /get-breakdown
      const breakdownRes = await fetch(`${env.apiBaseUrl}/get-breakdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_id: householdId,
          readings: simData.readings,
        }),
      });
      const breakdownData = await breakdownRes.json();

      // 3. Get updated dashboard snapshot
      return this.getDashboard(householdId);
    } catch (error) {
      console.warn(`[ApiDashboardService] Simulation flow error:`, error);
      throw error;
    }
  }
}
