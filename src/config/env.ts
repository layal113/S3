import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://s3-d0wz.onrender.com';

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  
  // In production builds (e.g. Vercel deployment or production mobile releases), point to the deployed Render backend
  if (process.env.NODE_ENV === 'production' || (typeof __DEV__ !== 'undefined' && !__DEV__)) {
    return PRODUCTION_API_URL;
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
