import { Platform } from 'react-native';

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  // Android Emulator uses 10.0.2.2 to connect to host machine's localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

export const env = {
  apiBaseUrl: getApiBaseUrl(),
} as const;
