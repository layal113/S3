import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '../theme';
import type { TariffStatus } from '../types/dashboard';
import { SectionHeader } from './SectionHeader';

export function TariffStatusCard({ tariff }: { tariff: TariffStatus }) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title="Current tariff"
        subtitle="Progress toward the next simulated tariff tier"
      />
      <View
        accessible
        accessibilityLabel={
          tariff.nextTier === null
            ? `Tier ${tariff.currentTier}, the highest tariff tier.`
            : `Tier ${tariff.currentTier}. ${tariff.levelPercent} percent toward tier ${tariff.nextTier}. ${tariff.remainingKwh} kilowatt-hours remaining.`
        }
        style={styles.card}
      >
        <View style={styles.topRow}>
          <View style={styles.titleRow}>
            <Ionicons
              color={colors.primary}
              name="speedometer-outline"
              size={22}
            />
            <Text style={styles.tier}>
              {tariff.nextTier === null
                ? `Tier ${tariff.currentTier} · Highest tier`
                : `Tier ${tariff.currentTier} → Tier ${tariff.nextTier}`}
            </Text>
          </View>
          <Text style={styles.status}>{tariff.statusLabel}</Text>
        </View>
        <View style={styles.meterArea}>
          <View style={styles.bar}>
            <View style={[styles.segment, styles.green]} />
            <View style={[styles.segment, styles.yellow]} />
            <View style={[styles.segment, styles.orange]} />
            <View style={[styles.segment, styles.red]} />
          </View>
          <View style={[styles.marker, { left: `${tariff.levelPercent}%` }]} />
        </View>
        <View style={styles.labels}>
          <Text style={styles.scale}>Low</Text>
          <Text style={styles.scale}>Moderate</Text>
          <Text style={styles.scale}>High</Text>
        </View>
        <Text style={styles.detail}>{tariff.detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  tier: { ...typography.heading, color: colors.text },
  status: { ...typography.label, color: colors.primaryDark },
  meterArea: {
    justifyContent: 'center',
    marginTop: spacing.sm,
    position: 'relative',
  },
  bar: {
    borderRadius: radii.pill,
    flexDirection: 'row',
    height: 14,
    overflow: 'hidden',
  },
  segment: { flex: 1 },
  green: { backgroundColor: '#3D9B61' },
  yellow: { backgroundColor: '#D7C34A' },
  orange: { backgroundColor: '#D9873D' },
  red: { backgroundColor: '#C84D4D' },
  marker: {
    backgroundColor: colors.text,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 24,
    marginLeft: -6,
    position: 'absolute',
    width: 12,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  scale: { fontSize: 11, color: colors.textMuted },
  detail: { ...typography.body, color: colors.textMuted },
});
