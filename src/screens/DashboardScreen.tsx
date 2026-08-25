import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApplianceBreakdown,
  DashboardErrorState,
  DashboardLoadingState,
  DashboardSummary,
  HomeHeader,
  HouseholdSelector,
  PriorityInsightCard,
  RecommendationCard,
} from '../components';
import { useDashboard } from '../hooks/useDashboard';
import type { DashboardService } from '../services';
import { ApiDashboardService } from '../services/ApiDashboardService';
import { useHouseholdProfile } from '../state/HouseholdProfileContext';
import { colors, radii, spacing, typography } from '../theme';
import type { HistoryAppliance } from '../types/history';

export function DashboardScreen({
  service,
  onAppliancePress,
  onRecommendationPress,
  onProfilePress,
}: {
  service: DashboardService;
  onAppliancePress: (appliance: HistoryAppliance) => void;
  onRecommendationPress: () => void;
  onProfilePress: () => void;
}) {
  const [isSimulating, setIsSimulating] = useState(false);
  const { profiles, selectedHouseholdId, selectedProfile, selectHousehold } =
    useHouseholdProfile();
  const households = service.getHouseholds().map((household) => ({
    ...household,
    name: profiles[household.id].householdName,
  }));
  const { data, error, isLoading, reload } = useDashboard(
    service,
    selectedHouseholdId,
  );

  const handleRunSimulation = async () => {
    if (service instanceof ApiDashboardService) {
      try {
        setIsSimulating(true);
        await service.triggerSimulation(selectedHouseholdId);
        await reload();
      } catch (err) {
        console.warn('Simulation trigger failed:', err);
      } finally {
        setIsSimulating(false);
      }
    } else {
      await reload();
    }
  };

  const displayedData = data
    ? {
        ...data,
        householdName: selectedProfile.householdName,
      }
    : null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HouseholdSelector
          households={households}
          selectedId={selectedHouseholdId}
          onSelect={selectHousehold}
        />

        <Pressable
          style={[styles.simButton, isSimulating && styles.simButtonDisabled]}
          onPress={handleRunSimulation}
          disabled={isSimulating}
        >
          <Text style={styles.simButtonText}>
            {isSimulating
              ? '⏳ Generating Signal & Running ML...'
              : ' Run Household Signal Simulation'}
          </Text>
        </Pressable>

        {isLoading || !displayedData ? (
          error ? (
            <DashboardErrorState message={error} onRetry={reload} />
          ) : (
            <View style={styles.stateContainer}>
              <DashboardLoadingState />
            </View>
          )
        ) : (
          <>
            <HomeHeader
              userName={selectedProfile.userName}
              householdName={displayedData.householdName}
              location={selectedProfile.location}
              homeType={selectedProfile.homeType}
              residents={selectedProfile.residents}
              billingPeriodLabel={displayedData.billingPeriodLabel}
              updatedAt={displayedData.updatedAt}
              onProfilePress={onProfilePress}
            />
            <DashboardSummary data={displayedData} />
            <PriorityInsightCard insight={displayedData.priorityInsight} />
            <ApplianceBreakdown
              appliances={displayedData.applianceBreakdown}
              onAppliancePress={onAppliancePress}
            />
            <RecommendationCard
              recommendation={displayedData.recommendation}
              onPress={onRecommendationPress}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  stateContainer: { minHeight: 420 },
  simButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  simButtonDisabled: {
    opacity: 0.6,
  },
  simButtonText: {
    ...typography.label,
    color: colors.surface,
  },
});
