import { env } from '../config/env';
import { apiEndpoints } from '../config/apiEndpoints';
import { simulatedHouseholds } from '../data/simulatedDashboard';
import type {
  DashboardData,
  HouseholdId,
  HouseholdOption,
} from '../types/dashboard';
import type {
  SimulationOptions,
  SimulationRunResult,
} from '../types/simulation';
import type { DashboardService } from './DashboardService';

export class ApiDashboardService implements DashboardService {
  getHouseholds(): HouseholdOption[] {
    return simulatedHouseholds;
  }

  async getDashboard(householdId: HouseholdId): Promise<DashboardData> {
    const url = `${env.apiBaseUrl}${apiEndpoints.dashboard(householdId)}`;
    try {
      console.info('[ApiDashboardService] Dashboard request started', {
        householdId,
        url,
      });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: DashboardData = await response.json();
      console.info('[ApiDashboardService] Dashboard request completed', {
        householdId,
        status: response.status,
      });
      return data;
    } catch (error) {
      console.warn(
        `[ApiDashboardService] Failed to fetch live dashboard from ${url}:`,
        error,
      );
      throw error;
    }
  }

  async triggerSimulation(
    householdId: HouseholdId = 'high-ac-home',
    options: SimulationOptions = { mode: 'surprise', useProfile: false },
  ): Promise<SimulationRunResult> {
    const simUrl = `${env.apiBaseUrl}/simulate-usage`;
    try {
      const before = await this.getDashboard(householdId);
      if (before.householdId !== householdId) {
        throw new Error(
          'The backend returned a different household. Please retry.',
        );
      }
      console.info('[ApiDashboardService] Simulation started', {
        householdId,
        url: simUrl,
      });
      // 1. Trigger simulation
      const simRes = await fetch(simUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          durationMinutes: 1440,
          intervalSeconds: 60,
          ...options,
        }),
      });
      if (!simRes.ok) {
        throw new Error(`Simulation HTTP status ${simRes.status}`);
      }
      const simData = await simRes.json();
      console.info('[ApiDashboardService] Signal generated', {
        householdId,
        readingCount: simData.readingCount ?? simData.readings?.length,
        scenario: simData.scenarioLabel,
      });

      // 2. Chained call: feed simulated readings directly into /get-breakdown
      const breakdownUrl = `${env.apiBaseUrl}/get-breakdown`;
      console.info('[ApiDashboardService] ML breakdown started', {
        householdId,
        url: breakdownUrl,
      });
      const breakdownRes = await fetch(breakdownUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_id: householdId,
          readings: simData.readings,
        }),
      });
      if (!breakdownRes.ok) {
        throw new Error(`Breakdown HTTP status ${breakdownRes.status}`);
      }
      const breakdownData = await breakdownRes.json();
      console.info('[ApiDashboardService] ML breakdown completed', {
        householdId,
        categoryCount: breakdownData.applianceBreakdown?.length ?? 0,
      });
      const after = await this.getDashboard(householdId);
      if (after.householdId !== householdId) {
        throw new Error(
          'The backend returned a different household. Please retry.',
        );
      }
      const configuration = simData.configuration ?? {};
      return {
        householdId,
        scenarioId: simData.scenarioId,
        scenarioLabel: simData.scenarioLabel,
        seed: simData.seed,
        configuration,
        events: simData.events ?? [],
        before,
        after,
        replayOptions: {
          ...options,
          mode: configuration.mode === 'custom' ? 'replay' : 'preset',
          scenarioId:
            configuration.base_scenario_id ??
            configuration.baseScenarioId ??
            configuration.scenario_id ??
            configuration.scenarioId ??
            simData.scenarioId,
          seed: simData.seed,
          conditions: options.conditions,
        },
      };
    } catch (error) {
      console.warn(`[ApiDashboardService] Simulation flow error:`, error);
      throw error;
    }
  }
}
