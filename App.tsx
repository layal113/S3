import { Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MiqyasSplashScreen } from './src/components/MiqyasSplashScreen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { dashboardService, historyService } from './src/services';
import { HouseholdProfileProvider } from './src/state/HouseholdProfileContext';

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded, fontError] = useFonts({
    Orbitron_700Bold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;

    void SplashScreen.hideAsync();
    const timer = setTimeout(() => setShowSplash(false), 5000);
    return () => clearTimeout(timer);
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  if (showSplash) {
    return (
      <>
        <StatusBar style="light" />
        <MiqyasSplashScreen />
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <HouseholdProfileProvider>
        <RootNavigator
          dashboardService={dashboardService}
          historyService={historyService}
        />
      </HouseholdProfileProvider>
    </SafeAreaProvider>
  );
}
