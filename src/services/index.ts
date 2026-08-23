import type { DashboardService } from './DashboardService';
import { MockDashboardService } from './MockDashboardService';
import type { HistoryService } from './HistoryService';
import { MockHistoryService } from './MockHistoryService';

// TODO: Replace this composition with an API-backed DashboardService once the
// backend contract and endpoints are finalized.
export const dashboardService: DashboardService = new MockDashboardService();
export const historyService: HistoryService = new MockHistoryService();

export type { DashboardService } from './DashboardService';
export type { HistoryService } from './HistoryService';
