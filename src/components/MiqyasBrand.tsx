import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';
import { MiqyasGaugeLogo } from './MiqyasGaugeLogo';

export function MiqyasBrand() {
  return (
    <View accessibilityLabel="Miqyas" style={styles.container}>
      <View style={styles.logo}>
        <MiqyasGaugeLogo color={colors.primary} trackColor={colors.tealSoft} />
      </View>
      <Text style={styles.wordmark}>Miqyas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logo: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 58,
  },
  wordmark: {
    color: colors.primary,
    fontFamily: 'Orbitron_700Bold',
    fontSize: 30,
    letterSpacing: -0.5,
    lineHeight: 38,
    transform: [{ skewX: '-20deg' }],
  },
});
