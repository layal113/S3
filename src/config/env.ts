import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://s3-d0wz.onrender.com';

function cleanUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getApiBaseUrl(): string {
  // Respect user-specified environment variables in production or local overrides
  const configuredUrl =
    process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL;

  if (configuredUrl && configuredUrl.trim().length > 0) {
    return cleanUrl(configuredUrl.trim());
  }

  // In production builds (e.g. Render Static Site deployment or production mobile releases), point to the deployed Render backend
  if (
    process.env.NODE_ENV === 'production' ||
    (typeof __DEV__ !== 'undefined' && !__DEV__)
  ) {
    return cleanUrl(PRODUCTION_API_URL);
  }

  // Local development: Android Emulator uses 10.0.2.2 to connect to host machine's localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

export const env = {
  apiBaseUrl: getApiBaseUrl(),
} as const;
