import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import type { DashboardData } from '../types/dashboard';
import { formatEgp, formatNumber } from '../utils/format';
import { KpiCard } from './KpiCard';

export function DashboardSummary({ data }: { data: DashboardData }) {
  return (
    <View style={styles.grid}>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
