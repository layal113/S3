import type { DashboardData, HouseholdId } from './dashboard';

export type SimulationMode = 'surprise' | 'preset' | 'custom' | 'replay';
export type OccupancyMode = 'away' | 'partial' | 'home';
export type UsageIntensity = 'low' | 'typical' | 'high';

export interface SimulationConditions {
  label?: string;
  temperatureC: number;
  thermostatC: number;
  acHours: number;
  occupancy: OccupancyMode;
  dayType: 'weekday' | 'weekend';
  usageIntensity: UsageIntensity;
  appliances: string[];
}

export interface SimulationProfileInput {
  homeType: string;
  occupants: number;
  location: string;
}

export interface SimulationOptions {
  mode: SimulationMode;
  scenarioId?: string;
  seed?: number;
  useProfile: boolean;
  profile?: SimulationProfileInput;
  conditions?: SimulationConditions;
}

export interface SimulationEvent {
  time: string;
  title: string;
  detail: string;
}

export interface SimulationRunResult {
  householdId: HouseholdId;
  scenarioId: string;
  scenarioLabel: string;
  seed: number;
  configuration: Record<string, unknown>;
  events: SimulationEvent[];
  before: DashboardData;
  after: DashboardData;
  replayOptions: SimulationOptions;
}
