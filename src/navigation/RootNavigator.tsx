import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
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
  const bottomPadding = isMobileWeb
    ? Math.max(insets.bottom, browserBottomInset, 8)
    : Math.max(insets.bottom, 6);
  const { selectedHouseholdId } = useHouseholdProfile();

  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={({ route }) => ({
          headerShown: false,
          animation: 'fade',
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            ...typography.label,
            fontSize: 10,
            marginTop: 2,
          },
          tabBarItemStyle: { minHeight: 54, paddingTop: 3 },
          tabBarStyle: {
            ...shadows.card,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 58 + bottomPadding,
            paddingBottom: bottomPadding,
            paddingTop: 5,
          },
          tabBarIcon: ({ color, focused, size }) => (
            <View style={[styles.iconContainer, focused && styles.activeIcon]}>
              <Ionicons
                color={color}
                name={
                  focused ? activeIconNames[route.name] : iconNames[route.name]
                }
                size={focused ? size + 1 : size}
              />
            </View>
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
              historyService={historyService}
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

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    borderRadius: 14,
    height: 30,
    justifyContent: 'center',
    width: 42,
  },
  activeIcon: { backgroundColor: colors.tealSoft },
});
