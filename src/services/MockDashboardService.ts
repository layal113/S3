import {
  simulatedDashboards,
  simulatedHouseholds,
} from '../data/simulatedDashboard';
import type {
  DashboardData,
  HouseholdId,
  HouseholdOption,
} from '../types/dashboard';
import type { DashboardService } from './DashboardService';

export class MockDashboardService implements DashboardService {
  getHouseholds(): HouseholdOption[] {
    return simulatedHouseholds;
  }

  async getDashboard(householdId: HouseholdId): Promise<DashboardData> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return simulatedDashboards[householdId];
  }
}
