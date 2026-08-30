export type ApplianceCategory =
  | 'Air conditioner'
  | 'Water heater'
  | 'Refrigerator'
  | 'Lighting'
  | 'Washing machine'
  | 'Oven'
  | 'Dishwasher'
  | 'Electronics'
  | 'Pool pump'
  | 'Other/unclassified'
  | 'Unattributed / baseline';

export type HouseholdId = 'high-ac-home' | 'efficient-flat' | 'family-villa';

export interface HouseholdOption {
  id: HouseholdId;
  name: string;
}

export interface ApplianceUsage {
  category: ApplianceCategory;
  consumptionKwh: number;
  sharePercent: number;
  modelScore?: number;
  modelScoreLabel?: 'High' | 'Medium' | 'Low' | 'N/A';
  confidence?: string;
  notYetTrained?: boolean;
}

export interface PriorityInsight {
  title: string;
  message: string;
  kind: 'warning' | 'recommendation';
}

export interface TariffStatus {
  statusLabel: string;
  detail: string;
  levelPercent: number;
  remainingKwh: number;
  currentTier: number;
  nextTier: number | null;
  projectedToExceed: boolean;
}

export interface Recommendation {
  title: string;
  description: string;
  estimatedMonthlySavingKwh: number;
}

export interface DashboardData {
  householdId: HouseholdId;
  householdName: string;
  billingPeriodLabel: string;
  currentConsumptionKwh: number;
  currentEstimatedCostEgp: number;
  predictedMonthEndBillEgp: number;
  projectedMonthlyKwh: number;
  previousMonthBillEgp: number;
  changeFromPreviousMonthPercent: number;
  priorityInsight: PriorityInsight;
  tariffStatus: TariffStatus;
  applianceBreakdown: ApplianceUsage[];
  recommendation: Recommendation;
  simulationScenario: string;
  simulationSeed: number | null;
  simulationConfiguration: Record<string, unknown>;
  simulationEvents: import('./simulation').SimulationEvent[];
  simulated: boolean;
  updatedAt: string;
}
