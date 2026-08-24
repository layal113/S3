/**
 * Placeholder REST paths for the future Miqyas backend.
 *
 * These paths are not called yet. The app continues to use local mock
 * services until an API-backed service is implemented.
 */
export const apiEndpoints = {
  households: '/v1/households',
  household: (householdId: string) => `/v1/households/${householdId}`,

  // One request containing everything needed to render the Home screen.
  dashboard: (householdId: string) => `/v1/households/${householdId}/dashboard`,

  // Smaller endpoints for screens that refresh data independently.
  currentUsage: (householdId: string) =>
    `/v1/households/${householdId}/usage/current`,
  billForecast: (householdId: string) =>
    `/v1/households/${householdId}/forecast`,
  tariffStatus: (householdId: string) =>
    `/v1/households/${householdId}/tariff-status`,
  applianceUsage: (householdId: string) =>
    `/v1/households/${householdId}/appliances/usage`,
  usageHistory: (householdId: string) =>
    `/v1/households/${householdId}/usage/history`,
  recommendations: (householdId: string) =>
    `/v1/households/${householdId}/recommendations`,
} as const;
