import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

function GaugeIcon({
  size = 108,
  color = '#FFFFFF',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg fill="none" height={size * 0.7} viewBox="0 0 72 50" width={size}>
      <Path
        d="M8 39 A28 28 0 0 1 64 39"
        stroke="rgba(255,255,255,0.28)"
        strokeLinecap="round"
        strokeWidth="7"
      />
      <Path
        d="M8 39 A28 28 0 0 1 64 39"
        stroke={color}
        strokeDasharray="70 90"
        strokeLinecap="round"
        strokeWidth="7"
      />
      <Circle cx="36" cy="39" fill={color} r="5" />
    </Svg>
  );
}

export function MiqyasSplashScreen() {
  const [meterLevel] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.delay(450),
      Animated.timing(meterLevel, {
        duration: 1800,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [meterLevel]);

  const needleRotation = meterLevel.interpolate({
    inputRange: [0, 1],
    outputRange: ['-68deg', '62deg'],
  });

  return (
    <View accessibilityLabel="Miqyas is loading" style={styles.container}>
      <View style={styles.iconCircle}>
        <GaugeIcon />
        <Animated.View
          style={[
            styles.needle,
            {
              transform: [
                { translateY: 9 },
                { rotate: needleRotation },
                { translateY: -9 },
              ],
            },
          ]}
        >
          <View style={styles.needleTip} />
        </Animated.View>
      </View>
      <Text style={styles.wordmark}>Miqyas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0F6E56',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  iconCircle: {
    alignItems: 'center',
    height: 92,
    justifyContent: 'center',
    marginBottom: 4,
    width: 120,
  },
  needle: {
    alignItems: 'center',
    bottom: 19,
    height: 32,
    left: 58,
    position: 'absolute',
    width: 4,
  },
  needleTip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    height: 29,
    width: 4,
  },
  wordmark: {
    color: '#FFFFFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 48,
    letterSpacing: -0.5,
    lineHeight: 58,
    transform: [{ skewX: '-20deg' }],
  },
});
