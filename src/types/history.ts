export type HistoryPeriod = '7d' | '4w';
export type HistoryUnit = 'kwh' | 'egp';
export type HistoryAppliance =
  | 'total'
  | 'airConditioner'
  | 'waterHeater'
  | 'refrigerator'
  | 'lighting'
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
  period: HistoryPeriod;
  granularity: 'day' | 'week';
  dateRangeLabel: string;
  points: HistoryPoint[];
}
