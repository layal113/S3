import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { UsageHistoryScreen } from '../screens/UsageHistoryScreen';
import type { DashboardService, HistoryService } from '../services';
import { colors, shadows, typography } from '../theme';
import type { HistoryAppliance } from '../types/history';

export type RootTabParamList = {
  Home: undefined;
  Insights:
    { appliance?: HistoryAppliance; selectionRequestId?: number } | undefined;
  Recommendations: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const iconNames: Record<
  keyof RootTabParamList,
  keyof typeof Ionicons.glyphMap
> = {
  Home: 'home-outline',
  Insights: 'stats-chart-outline',
  Recommendations: 'leaf-outline',
  Profile: 'person-outline',
};

const activeIconNames: Record<
  keyof RootTabParamList,
  keyof typeof Ionicons.glyphMap
> = {
  Home: 'home',
  Insights: 'stats-chart',
  Recommendations: 'leaf',
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
              onRecommendationPress={() =>
                navigation.navigate('Recommendations')
              }
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
        <Tab.Screen name="Recommendations">
          {() => <PlaceholderScreen title="Recommendations" />}
        </Tab.Screen>
        <Tab.Screen name="Profile">
          {() => <PlaceholderScreen title="Profile" />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
