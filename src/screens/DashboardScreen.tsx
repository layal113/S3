import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApplianceBreakdown,
  DashboardErrorState,
  DashboardLoadingState,
  DashboardSummary,
  HomeHeader,
  HouseholdSelector,
  PredictedBillCard,
  PriorityInsightCard,
  RecommendationCard,
  TariffStatusCard,
} from '../components';
import { useDashboard } from '../hooks/useDashboard';
import type { DashboardService } from '../services';
import { colors, spacing } from '../theme';
import type { HouseholdId } from '../types/dashboard';
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
  const households = service.getHouseholds();
  const [selectedHouseholdId, setSelectedHouseholdId] =
    useState<HouseholdId>('high-ac-home');
  const { data, error, isLoading, reload } = useDashboard(
    service,
    selectedHouseholdId,
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HouseholdSelector
          households={households}
          selectedId={selectedHouseholdId}
          onSelect={setSelectedHouseholdId}
        />
        {isLoading || !data ? (
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
              householdName={data.householdName}
              billingPeriodLabel={data.billingPeriodLabel}
              updatedAt={data.updatedAt}
              onProfilePress={onProfilePress}
            />
            <PredictedBillCard
              billEgp={data.predictedMonthEndBillEgp}
              projectedKwh={data.projectedMonthlyKwh}
              changePercent={data.changeFromPreviousMonthPercent}
              previousBillEgp={data.previousMonthBillEgp}
            />
            <DashboardSummary data={data} />
            <TariffStatusCard tariff={data.tariffStatus} />
            <PriorityInsightCard insight={data.priorityInsight} />
            <ApplianceBreakdown
              appliances={data.applianceBreakdown}
              onAppliancePress={onAppliancePress}
            />
            <RecommendationCard
              recommendation={data.recommendation}
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
});
