import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';
import { formatUpdatedTime } from '../utils/format';

export function HomeHeader({
  householdName,
  billingPeriodLabel,
  updatedAt,
  onProfilePress,
}: {
  householdName: string;
  billingPeriodLabel: string;
  updatedAt: string;
  onProfilePress: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Ionicons color={colors.primary} name="flash" size={28} />
            <Ionicons color={colors.teal} name="leaf" size={20} />
          </View>
          <View>
            <Text style={styles.brand}>S3 ENERGY</Text>
            <Text accessibilityRole="header" style={styles.appName}>
              Energy overview
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onProfilePress}
          style={styles.profile}
        >
          <Ionicons color={colors.primary} name="person-outline" size={23} />
        </Pressable>
      </View>
      <View style={styles.householdBlock}>
        <Text style={styles.label}>SELECTED HOUSEHOLD</Text>
        <Text style={styles.household}>{householdName}</Text>
        <Text style={styles.meta}>Billing period: {billingPeriodLabel}</Text>
        <Text style={styles.meta}>
          Last updated: {formatUpdatedTime(updatedAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  logo: { alignItems: 'center', flexDirection: 'row' },
  brand: {
    ...typography.label,
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 1,
  },
  appName: { ...typography.title, color: colors.text },
  profile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  householdBlock: { gap: spacing.xs },
  label: {
    ...typography.label,
    color: colors.teal,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  household: { ...typography.heading, color: colors.text },
  meta: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
