import Ionicons from '@expo/vector-icons/Ionicons';
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
import { Reveal } from '../components/Reveal';
import {
  SimulationResultSheet,
  SimulationSetupSheet,
} from '../components/SimulationFlow';
import { useDashboard } from '../hooks/useDashboard';
import type { DashboardService } from '../services';
import { ApiDashboardService } from '../services/ApiDashboardService';
import { useHouseholdProfile } from '../state/HouseholdProfileContext';
import { colors, layout, radii, spacing, typography } from '../theme';
import type { HistoryAppliance } from '../types/history';
import type {
  SimulationOptions,
  SimulationRunResult,
} from '../types/simulation';
import { feedback } from '../utils/feedback';

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
  const [simulationSetupOpen, setSimulationSetupOpen] = useState(false);
  const [simulationResult, setSimulationResult] =
    useState<SimulationRunResult | null>(null);
  const [simulationResultOpen, setSimulationResultOpen] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const {
    profiles,
    selectedHouseholdId,
    selectedProfile,
    selectHousehold,
    notifyHouseholdDataChanged,
  } = useHouseholdProfile();
  const households = service.getHouseholds().map((household) => ({
    ...household,
    name: profiles[household.id].householdName,
  }));
  const { data, error, isLoading, reload } = useDashboard(
    service,
    selectedHouseholdId,
  );

  const handleRunSimulation = async (
    options: SimulationOptions,
    comparisonBefore?: SimulationRunResult['before'],
  ) => {
    if (service instanceof ApiDashboardService) {
      try {
        setSimulationError(null);
        setIsSimulating(true);
        const result = await service.triggerSimulation(
          selectedHouseholdId,
          options,
        );
        const comparableResult = comparisonBefore
          ? { ...result, before: comparisonBefore }
          : result;
        setSimulationResult(comparableResult);
        setSimulationSetupOpen(false);
        setSimulationResultOpen(true);
        notifyHouseholdDataChanged(selectedHouseholdId);
        await reload();
        void feedback.success();
      } catch (err) {
        console.warn('Simulation trigger failed:', err);
        setSimulationSetupOpen(false);
        void feedback.warning();
        setSimulationError(
          err instanceof Error
            ? err.message
            : 'The simulation could not be completed. Please retry.',
        );
      } finally {
        setIsSimulating(false);
      }
    } else {
      await reload();
      setSimulationSetupOpen(false);
    }
  };

  const handleReplay = async () => {
    if (!simulationResult) return;
    await handleRunSimulation(
      simulationResult.replayOptions,
      simulationResult.before,
    );
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
          style={({ pressed }) => [
            styles.simButton,
            isSimulating && styles.simButtonDisabled,
            pressed && !isSimulating && styles.simButtonPressed,
          ]}
          onPress={() => {
            setSimulationError(null);
            setSimulationSetupOpen(true);
          }}
          disabled={isSimulating}
        >
          <Ionicons color={colors.surface} name="flask-outline" size={19} />
          <Text style={styles.simButtonText}>
            {isSimulating
              ? 'Generating household scenario…'
              : 'Simulate household data'}
          </Text>
        </Pressable>

        {simulationError ? (
          <View accessibilityRole="alert" style={styles.simulationError}>
            <Ionicons
              color={colors.danger}
              name="alert-circle-outline"
              size={20}
            />
            <Text style={styles.simulationErrorText}>{simulationError}</Text>
          </View>
        ) : null}

        {isLoading || !displayedData ? (
          error ? (
            <DashboardErrorState message={error} onRetry={reload} />
          ) : (
            <View style={styles.stateContainer}>
              <DashboardLoadingState />
            </View>
          )
        ) : (
          <Reveal
            key={`${selectedHouseholdId}:${displayedData.updatedAt}`}
            style={styles.dashboardContent}
          >
            <Reveal>
              <HomeHeader
                userName={selectedProfile.userName}
                householdName={displayedData.householdName}
                location={selectedProfile.location}
                homeType={selectedProfile.homeType}
                residents={selectedProfile.residents}
                billingPeriodLabel={displayedData.billingPeriodLabel}
                updatedAt={displayedData.updatedAt}
                simulationScenario={displayedData.simulationScenario}
                onProfilePress={onProfilePress}
              />
            </Reveal>
            <Reveal delay={45}>
              <DashboardSummary data={displayedData} />
            </Reveal>
            <Reveal delay={90}>
              <PriorityInsightCard insight={displayedData.priorityInsight} />
            </Reveal>
            <Reveal delay={135}>
              <ApplianceBreakdown
                appliances={displayedData.applianceBreakdown}
                onAppliancePress={onAppliancePress}
              />
            </Reveal>
            <Reveal delay={180}>
              <RecommendationCard
                recommendation={displayedData.recommendation}
                onPress={onRecommendationPress}
              />
            </Reveal>
          </Reveal>
        )}
        <View
          accessible
          accessibilityLabel="Support hotline, 16016"
          style={styles.hotline}
        >
          <View style={styles.hotlineCopy}>
            <Text style={styles.hotlineLabel}>SUPPORT HOTLINE</Text>
            <View style={styles.hotlineNumberRow}>
              <Ionicons color={colors.teal} name="call-outline" size={18} />
              <Text style={styles.hotlineNumber}>16016</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <SimulationSetupSheet
        householdId={selectedHouseholdId}
        isRunning={isSimulating}
        onClose={() => setSimulationSetupOpen(false)}
        onRun={(options) => void handleRunSimulation(options)}
        profile={selectedProfile}
        visible={simulationSetupOpen}
      />
      <SimulationResultSheet
        isReplaying={isSimulating}
        onClose={() => setSimulationResultOpen(false)}
        onReplay={() => void handleReplay()}
        result={simulationResult}
        visible={simulationResultOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: {
    ...layout.screenContent,
    gap: spacing.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  dashboardContent: { gap: spacing.xl },
  stateContainer: { minHeight: 420 },
  simButton: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  simButtonPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  simButtonText: {
    ...typography.label,
    color: colors.surface,
  },
  simulationError: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  simulationErrorText: {
    ...typography.body,
    color: colors.danger,
    flex: 1,
  },
  hotline: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  hotlineCopy: { alignItems: 'center' },
  hotlineNumberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hotlineLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.7,
  },
  hotlineNumber: {
    ...typography.body,
    color: colors.primaryDark,
    textAlign: 'center',
  },
});
