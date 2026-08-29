import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMobileBrowserBottomInset } from '../hooks/useMobileBrowserBottomInset';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SmartTipsScreen } from '../screens/SmartTipsScreen';
import { UsageHistoryScreen } from '../screens/UsageHistoryScreen';
import type { DashboardService, HistoryService } from '../services';
import { useHouseholdProfile } from '../state/HouseholdProfileContext';
import { colors, shadows, typography } from '../theme';
import type { HistoryAppliance } from '../types/history';

export type RootTabParamList = {
  Home: undefined;
  Insights:
    { appliance?: HistoryAppliance; selectionRequestId?: number } | undefined;
  'Smart Tips': undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const iconNames: Record<
  keyof RootTabParamList,
  keyof typeof Ionicons.glyphMap
> = {
  Home: 'home-outline',
  Insights: 'stats-chart-outline',
  'Smart Tips': 'leaf-outline',
  Profile: 'person-outline',
};

const activeIconNames: Record<
  keyof RootTabParamList,
  keyof typeof Ionicons.glyphMap
> = {
  Home: 'home',
  Insights: 'stats-chart',
  'Smart Tips': 'leaf',
  Profile: 'person',
};

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
  },
};

export function RootNavigator({
  dashboardService,
  historyService,
}: {
  dashboardService: DashboardService;
  historyService: HistoryService;
}) {
  const insets = useSafeAreaInsets();
  const browserBottomInset = useMobileBrowserBottomInset();
  const { width } = useWindowDimensions();
  const isMobileWeb = Platform.OS === 'web' && width <= 768;
  const { selectedHouseholdId } = useHouseholdProfile();

  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        safeAreaInsets={{ bottom: insets.bottom }}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { ...typography.label, fontSize: 11 },
          tabBarStyle: {
            ...shadows.card,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            marginBottom: isMobileWeb ? Math.max(16, browserBottomInset) : 0,
            minHeight: 60,
            paddingBottom: 6,
            paddingTop: 8,
          },
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              color={color}
              name={
                focused ? activeIconNames[route.name] : iconNames[route.name]
              }
              size={size}
            />
          ),
        })}
      >
        <Tab.Screen name="Home">
          {({ navigation }) => (
            <DashboardScreen
              service={dashboardService}
              onAppliancePress={(appliance) =>
                navigation.navigate('Insights', {
                  appliance,
                  selectionRequestId: Date.now(),
                })
              }
              onRecommendationPress={() => navigation.navigate('Smart Tips')}
              onProfilePress={() => navigation.navigate('Profile')}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Insights">
          {({ route }) => (
            <UsageHistoryScreen
              key={route.params?.selectionRequestId ?? 'insights-default'}
              service={historyService}
              initialAppliance={route.params?.appliance}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Smart Tips">
          {() => (
            <SmartTipsScreen
              key={selectedHouseholdId}
              service={dashboardService}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Profile">
          {() => <ProfileScreen key={selectedHouseholdId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
