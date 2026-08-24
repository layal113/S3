import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../theme';

interface Props {
  label: string;
  value: string;
  qualifier: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: 'blue' | 'teal' | 'warning';
  meterPercent?: number;
}

export function KpiCard({
  label,
  value,
  qualifier,
  icon,
  accent = 'blue',
  meterPercent,
}: Props) {
  const accentColor =
    accent === 'teal'
      ? colors.teal
      : accent === 'warning'
        ? colors.warning
        : colors.primary;
  const safeMeterPercent = Math.max(0, Math.min(meterPercent ?? 0, 100));

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}. ${qualifier}`}
      style={styles.card}
    >
      <View
        style={[
          styles.icon,
          accent === 'teal' && styles.tealIcon,
          accent === 'warning' && styles.warningIcon,
        ]}
      >
        <Ionicons color={accentColor} name={icon} size={21} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>
        {value}
      </Text>
      {meterPercent !== undefined ? (
        <View
          accessibilityLabel={`${safeMeterPercent}% toward the next tariff tier`}
          style={styles.meter}
        >
          <View style={[styles.segment, styles.green]} />
          <View style={[styles.segment, styles.yellow]} />
          <View style={[styles.segment, styles.orange]} />
          <View style={[styles.segment, styles.red]} />
          <View style={[styles.marker, { left: `${safeMeterPercent}%` }]} />
        </View>
      ) : null}
      <Text style={styles.qualifier}>{qualifier}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    flexBasis: '40%',
    flexGrow: 1,
    flexShrink: 0,
    gap: spacing.sm,
    height: 200,
    minWidth: 150,
    padding: spacing.lg,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.blueSoft,
    borderRadius: radii.sm,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  tealIcon: { backgroundColor: colors.tealSoft },
  warningIcon: { backgroundColor: colors.warningSoft },
  label: { ...typography.label, color: colors.textMuted },
  value: { ...typography.value, color: colors.text },
  qualifier: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  meter: {
    borderRadius: radii.pill,
    flexDirection: 'row',
    height: 10,
    marginRight: spacing.xs,
    marginTop: spacing.xs,
    position: 'relative',
  },
  segment: { flex: 1 },
  green: {
    backgroundColor: '#3D9B61',
    borderBottomLeftRadius: radii.pill,
    borderTopLeftRadius: radii.pill,
  },
  yellow: { backgroundColor: '#D7C34A' },
  orange: { backgroundColor: '#D9873D' },
  red: {
    backgroundColor: '#C84D4D',
    borderBottomRightRadius: radii.pill,
    borderTopRightRadius: radii.pill,
  },
  marker: {
    backgroundColor: colors.text,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 18,
    marginLeft: -5,
    position: 'absolute',
    top: -4,
    width: 10,
  },
});
