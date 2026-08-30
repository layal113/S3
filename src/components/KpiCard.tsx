import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  borders,
  colors,
  motion,
  radii,
  shadows,
  spacing,
  typography,
} from '../theme';
import { AnimatedMetric } from './AnimatedMetric';

interface Props {
  label: string;
  value: string;
  qualifier: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: 'blue' | 'teal' | 'warning';
  meterPercent?: number;
  numericValue?: number;
  valueFormatter?: (value: number) => string;
}

export function KpiCard({
  label,
  value,
  qualifier,
  icon,
  accent = 'blue',
  meterPercent,
  numericValue,
  valueFormatter,
}: Props) {
  const accentColor =
    accent === 'teal'
      ? colors.teal
      : accent === 'warning'
        ? colors.warning
        : colors.primary;
  const safeMeterPercent = Math.max(0, Math.min(meterPercent ?? 0, 100));
  const [markerPosition] = useState(
    () => new Animated.Value(safeMeterPercent),
  );
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      markerPosition.setValue(safeMeterPercent);
      return;
    }
    Animated.timing(markerPosition, {
      duration: motion.deliberate,
      easing: Easing.out(Easing.cubic),
      toValue: safeMeterPercent,
      useNativeDriver: false,
    }).start();
  }, [markerPosition, reducedMotion, safeMeterPercent]);

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
      {numericValue !== undefined && valueFormatter ? (
        <AnimatedMetric
          formatter={valueFormatter}
          style={styles.value}
          value={numericValue}
        />
      ) : (
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      )}
      {meterPercent !== undefined ? (
        <View
          accessibilityLabel={`${safeMeterPercent}% toward the next tariff tier`}
          style={styles.meter}
        >
          <View style={[styles.segment, styles.green]} />
          <View style={[styles.segment, styles.yellow]} />
          <View style={[styles.segment, styles.orange]} />
          <View style={[styles.segment, styles.red]} />
          <Animated.View
            style={[
              styles.marker,
              {
                left: markerPosition.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      ) : null}
      <Text style={styles.qualifier}>{qualifier}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...borders.card,
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
  value: {
    ...typography.value,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
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
