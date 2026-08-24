import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';
import { formatUpdatedTime } from '../utils/format';
import { MiqyasBrand } from './MiqyasBrand';

export function HomeHeader({
  userName,
  householdName,
  location,
  homeType,
  residents,
  billingPeriodLabel,
  updatedAt,
  onProfilePress,
}: {
  userName: string;
  householdName: string;
  location: string;
  homeType: string;
  residents: number;
  billingPeriodLabel: string;
  updatedAt: string;
  onProfilePress: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <MiqyasBrand />
      </View>
      <View style={styles.householdRow}>
        <View style={styles.householdBlock}>
          <Text style={styles.greeting}>Good morning, {userName}</Text>
          <Text style={styles.label}>SELECTED HOUSEHOLD</Text>
          <Text style={styles.household}>{householdName}</Text>
          <Text style={styles.meta}>
            {location} · {homeType} · {residents}{' '}
            {residents === 1 ? 'resident' : 'residents'}
          </Text>
          <Text style={styles.meta}>Billing period: {billingPeriodLabel}</Text>
          <Text style={styles.meta}>
            Last updated: {formatUpdatedTime(updatedAt)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onProfilePress}
          style={styles.profile}
        >
          <Ionicons color={colors.primary} name="person-outline" size={38} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  profile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 72,
    justifyContent: 'center',
    marginRight: 44,
    width: 72,
  },
  householdRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  householdBlock: { flex: 1, gap: spacing.xs },
  greeting: { ...typography.body, color: colors.textMuted },
  label: {
    ...typography.label,
    color: colors.teal,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  household: { ...typography.heading, color: colors.text },
  meta: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
