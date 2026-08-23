import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import type { PriorityInsight } from '../types/dashboard';

export function PriorityInsightCard({ insight }: { insight: PriorityInsight }) {
  const warning = insight.kind === 'warning';
  return (
    <View style={[styles.card, !warning && styles.positiveCard]}>
      <Ionicons
        color={warning ? colors.warning : colors.teal}
        name={warning ? 'warning-outline' : 'checkmark-circle-outline'}
        size={24}
      />
      <View style={styles.copy}>
        <Text style={styles.title}>{insight.title}</Text>
        <Text style={styles.message}>{insight.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  positiveCard: { backgroundColor: colors.tealSoft, borderColor: '#A7CDB5' },
  copy: { flex: 1, gap: spacing.xs },
  title: { ...typography.label, color: colors.text },
  message: { ...typography.body, color: colors.textMuted },
});
