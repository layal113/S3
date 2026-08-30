export type SmartTipCategory =
  'heating' | 'cooling' | 'appliances' | 'lighting' | 'behavior';

export interface SmartTip {
  id: string;
  title: string;
  summary: string;
  estimatedSavings: string;
  category: SmartTipCategory;
}

export interface HouseholdTipData {
  householdId: string;
  homeType: string;
  occupants: number;
  avgKwh: number;
  anomaliesSummary: string;
  peakHours: string;
}

export interface FullUsageData {
  datasetMetadata: {
    selectedHouseholdId: string;
    simulationRevision: number;
    dashboardUpdatedAt: string;
    capturedAt: string;
  };
  household: {
    id: string;
    name: string;
    userName: string;
    homeType: string;
    location: string;
    occupants: number;
  };
  dashboard: import('./dashboard').DashboardData;
  history: {
    recentDaily: import('./history').UsageHistoryData | null;
    recentWeekly: import('./history').UsageHistoryData | null;
    olderMonthly: import('./history').UsageHistoryData | null;
  };
  historyPolicy: string;
}

export interface TipChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}
