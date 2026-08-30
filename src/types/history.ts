export type HistoryPeriod = '7d' | '4w' | '6m';
export type HistoryUnit = 'kwh' | 'egp';
export type HistoryAppliance =
  | 'total'
  | 'airConditioner'
  | 'waterHeater'
  | 'refrigerator'
  | 'lighting'
  | 'washingMachine'
  | 'oven'
  | 'dishwasher'
  | 'electronics'
  | 'poolPump'
  | 'other';

export interface HistoryPoint {
  timestamp: string;
  totalKWh: number;
  estimatedCostEGP: number;
  baselineKWh: number;
  baselineCostEGP: number;
  appliances: Record<
    Exclude<HistoryAppliance, 'total'>,
    { kWh: number; costEGP: number }
  >;
  anomaly?: { title: string; explanation: string };
}

export interface UsageHistoryData {
  householdId: string;
  period: HistoryPeriod;
  granularity: 'day' | 'week' | 'month';
  dateRangeLabel: string;
  scenarioLabel: string;
  simulationSeed: number | null;
  periodTotalKWh: number;
  periodEstimatedCostEgp: number;
  billingCycleKWh: number;
  billingCycleCostEgp: number;
  projectedMonthlyKWh: number;
  projectedMonthlyCostEgp: number;
  availableAppliances: Exclude<HistoryAppliance, 'total'>[];
  billingCycleAppliances: Record<
    Exclude<HistoryAppliance, 'total'>,
    { kWh: number; costEGP: number }
  >;
  points: HistoryPoint[];
}
