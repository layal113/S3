import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme';

export function DashboardLoadingState() {
  return (
    <SafeAreaView style={styles.centered}>
      <ActivityIndicator
        accessibilityLabel="Loading dashboard"
        color={colors.primary}
        size="large"
      />
      <Text style={styles.message}>Loading energy overview…</Text>
    </SafeAreaView>
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
    <SafeAreaView style={styles.centered}>
      <Text accessibilityRole="header" style={styles.title}>
        Unable to load dashboard
      </Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </SafeAreaView>
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
});
