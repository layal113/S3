import type { DashboardService } from './DashboardService';
import { ApiDashboardService } from './ApiDashboardService';
import type { HistoryService } from './HistoryService';
import { ApiHistoryService } from './ApiHistoryService';

// Active dashboard service points to the live FastAPI backend
export const dashboardService: DashboardService = new ApiDashboardService();
export const historyService: HistoryService = new ApiHistoryService();

export type { DashboardService } from './DashboardService';
export type { HistoryService } from './HistoryService';
export { ApiDashboardService } from './ApiDashboardService';
export { ApiHistoryService } from './ApiHistoryService';
