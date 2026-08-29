export type ApplianceCategory =
  | 'Air conditioner'
  | 'Water heater'
  | 'Refrigerator'
  | 'Lighting'
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
  nextTier: number;
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
  simulated: boolean;
  updatedAt: string;
}
