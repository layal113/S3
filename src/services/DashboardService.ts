import type {
  DashboardData,
  HouseholdId,
  HouseholdOption,
} from '../types/dashboard';

export interface DashboardService {
  getHouseholds(): HouseholdOption[];
  getDashboard(householdId: HouseholdId): Promise<DashboardData>;
}
