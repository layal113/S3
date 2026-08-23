import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '../theme';
import type { Recommendation } from '../types/dashboard';
import { formatNumber } from '../utils/format';

export function RecommendationCard({
  recommendation,
  onPress,
}: {
  recommendation: Recommendation;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open recommendations. ${recommendation.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.icon}>
          <Ionicons color={colors.teal} name="sparkles-outline" size={21} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>AI RECOMMENDATION · SIMULATED</Text>
          <Text style={styles.title}>{recommendation.title}</Text>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={21} />
      </View>
      <Text style={styles.description}>{recommendation.description}</Text>
      <Text style={styles.saving}>
        Estimated potential:{' '}
        {formatNumber(recommendation.estimatedMonthlySavingKwh)} kWh/month
      </Text>
      <Text style={styles.action}>View recommendations</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.68 },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.tealSoft,
    borderRadius: radii.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: { flex: 1 },
  eyebrow: { ...typography.label, color: colors.teal, fontSize: 10 },
  title: { ...typography.heading, color: colors.text },
  description: { ...typography.body, color: colors.textMuted },
  saving: { ...typography.label, color: colors.success },
  action: { ...typography.label, color: colors.primary },
});
