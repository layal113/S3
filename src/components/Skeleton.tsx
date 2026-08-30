import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, radii, spacing } from '../theme';

export function SkeletonBlock({
  height,
  width = '100%',
}: {
  height: number;
  width?: number | `${number}%`;
}) {
  const [opacity] = useState(() => new Animated.Value(0.45));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.65);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.82,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.42,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);

  return <Animated.View style={[styles.block, { height, opacity, width }]} />;
}

export function CardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <SkeletonBlock height={38} width={38} />
      <SkeletonBlock height={12} width="42%" />
      <SkeletonBlock height={26} width="68%" />
      <SkeletonBlock height={12} width="88%" />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceStrong, borderRadius: radii.sm },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    minHeight: 190,
    padding: spacing.lg,
  },
  compactCard: { minHeight: 110 },
});
