export const env = {
  // TODO: Use this value in the API-backed service after its contract exists.
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000',
} as const;
