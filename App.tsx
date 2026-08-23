import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { dashboardService, historyService } from './src/services';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator
        dashboardService={dashboardService}
        historyService={historyService}
      />
    </SafeAreaProvider>
  );
}
