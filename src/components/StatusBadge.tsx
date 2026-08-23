import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';

interface StatusBadgeProps {
  label: string;
}

export function StatusBadge({ label }: StatusBadgeProps) {
  return (
    <View accessibilityRole="text" style={styles.badge}>
      <View style={styles.dot} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.tealSoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: { backgroundColor: colors.teal, borderRadius: 4, height: 8, width: 8 },
  label: { ...typography.label, color: colors.teal },
});
