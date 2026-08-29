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

export interface TipChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}
