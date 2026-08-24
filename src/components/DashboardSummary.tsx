import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import type { DashboardData } from '../types/dashboard';
import { formatEgp, formatNumber } from '../utils/format';
import { KpiCard } from './KpiCard';

export function DashboardSummary({ data }: { data: DashboardData }) {
  const comparisonDirection =
    data.changeFromPreviousMonthPercent > 0 ? 'higher' : 'lower';

  return (
    <View style={styles.grid}>
      <KpiCard
        icon="wallet-outline"
        label="Predicted month bill"
        qualifier={`${formatNumber(Math.abs(data.changeFromPreviousMonthPercent))}% ${comparisonDirection} than last month · ${formatNumber(data.projectedMonthlyKwh)} kWh projected`}
        value={formatEgp(data.predictedMonthEndBillEgp)}
      />
      <KpiCard
        icon="speedometer-outline"
        accent="teal"
        label="Current tariff"
        qualifier={`${formatNumber(data.tariffStatus.remainingKwh)} kWh remaining until Tier ${data.tariffStatus.nextTier}`}
        value={`Tier ${data.tariffStatus.currentTier}`}
        meterPercent={data.tariffStatus.levelPercent}
      />
      <KpiCard
        icon="flash-outline"
        label="Electricity used"
        qualifier="Billing period to date · simulated"
        value={`${formatNumber(data.currentConsumptionKwh)} kWh`}
      />
      <KpiCard
        icon="cash-outline"
        accent="teal"
        label="Cost so far"
        qualifier="Estimated cost to date · simulated"
        value={formatEgp(data.currentEstimatedCostEgp)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
