import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../theme';

interface Props {
  label: string;
  value: string;
  qualifier: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: 'blue' | 'teal';
}

export function KpiCard({
  label,
  value,
  qualifier,
  icon,
  accent = 'blue',
}: Props) {
  const accentColor = accent === 'teal' ? colors.teal : colors.primary;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}. ${qualifier}`}
      style={styles.card}
    >
      <View style={[styles.icon, accent === 'teal' && styles.tealIcon]}>
        <Ionicons color={accentColor} name={icon} size={21} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>
        {value}
      </Text>
      <Text style={styles.qualifier}>{qualifier}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    flex: 1,
    gap: spacing.sm,
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
  label: { ...typography.label, color: colors.textMuted },
  value: { ...typography.value, color: colors.text },
  qualifier: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
