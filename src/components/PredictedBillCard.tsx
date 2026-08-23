import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { formatEgp, formatNumber } from '../utils/format';

interface Props {
  billEgp: number;
  projectedKwh: number;
  changePercent: number;
  previousBillEgp: number;
}

export function PredictedBillCard({
  billEgp,
  projectedKwh,
  changePercent,
  previousBillEgp,
}: Props) {
  const higher = changePercent > 0;
  return (
    <View accessible style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.icon}>
          <Ionicons color={colors.primary} name="wallet-outline" size={24} />
        </View>
        <Text style={styles.label}>Predicted month-end bill</Text>
      </View>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>
        {formatEgp(billEgp)}
      </Text>
      <Text style={styles.energy}>
        Projected monthly energy: {formatNumber(projectedKwh)} kWh
      </Text>
      <View style={[styles.comparison, !higher && styles.positiveComparison]}>
        <Ionicons
          color={higher ? colors.warning : colors.success}
          name={higher ? 'trending-up' : 'trending-down'}
          size={18}
        />
        <Text style={[styles.comparisonText, !higher && styles.positiveText]}>
          {formatNumber(Math.abs(changePercent))}% {higher ? 'higher' : 'lower'}{' '}
          than last month
        </Text>
      </View>
      <Text style={styles.previous}>
        Last month: {formatEgp(previousBillEgp)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.blueSoft,
    borderRadius: radii.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  label: { ...typography.label, color: colors.textMuted },
  value: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 43,
    marginTop: spacing.xs,
  },
  energy: { ...typography.body, color: colors.textMuted },
  comparison: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  positiveComparison: { backgroundColor: colors.successSoft },
  comparisonText: { ...typography.label, color: colors.warning },
  positiveText: { color: colors.success },
  previous: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
