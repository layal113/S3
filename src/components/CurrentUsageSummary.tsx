import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '../theme';
import { formatEgp, formatNumber } from '../utils/format';

export function CurrentUsageSummary({
  consumptionKwh,
  costEgp,
}: {
  consumptionKwh: number;
  costEgp: number;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`Current use ${formatNumber(consumptionKwh)} kilowatt-hours. Cost so far ${formatEgp(costEgp)}.`}
      style={styles.card}
    >
      <View style={styles.item}>
        <Ionicons color={colors.primary} name="flash" size={27} />
        <View>
          <Text style={styles.label}>Current use</Text>
          <Text style={styles.value}>{formatNumber(consumptionKwh)} kWh</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.item}>
        <Ionicons color={colors.teal} name="cash-outline" size={27} />
        <View>
          <Text style={styles.label}>Cost so far</Text>
          <Text style={styles.value}>{formatEgp(costEgp)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    flexDirection: 'row',
    minHeight: 104,
    paddingHorizontal: spacing.xl,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  divider: {
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginVertical: spacing.md,
    width: 1,
  },
  label: { ...typography.label, color: colors.textMuted },
  value: { ...typography.value, color: colors.text, fontSize: 22 },
});
