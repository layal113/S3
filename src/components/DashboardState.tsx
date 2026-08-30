import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import { CardSkeleton, SkeletonBlock } from './Skeleton';

export function DashboardLoadingState() {
  return (
    <View accessibilityLabel="Loading dashboard" style={styles.skeletonRoot}>
      <SkeletonBlock height={32} width="52%" />
      <SkeletonBlock height={70} />
      <View style={styles.skeletonGrid}>
        <View style={styles.skeletonColumn}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
        <View style={styles.skeletonColumn}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      </View>
      <Text style={styles.loadingMessage}>
        Syncing the latest household data…
      </Text>
    </View>
  );
}

export function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.centered}>
      <View style={styles.errorIcon}>
        <Ionicons
          color={colors.warning}
          name="cloud-offline-outline"
          size={28}
        />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        Unable to load dashboard
      </Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  skeletonRoot: { gap: spacing.lg, paddingVertical: spacing.md },
  skeletonGrid: { flexDirection: 'row', gap: spacing.md },
  skeletonColumn: { flex: 1, gap: spacing.md },
  loadingMessage: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorIcon: {
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderRadius: radii.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  title: { ...typography.heading, color: colors.text },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { ...typography.label, color: colors.background },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
});
