import { useEffect, useRef, useState } from 'react';
import { Animated, type StyleProp, type TextStyle } from 'react-native';

import { motion } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

export function AnimatedMetric({
  formatter,
  style,
  value,
}: {
  formatter: (value: number) => string;
  style?: StyleProp<TextStyle>;
  value: number;
}) {
  const [animation] = useState(() => new Animated.Value(value));
  const previous = useRef(value);
  const [displayed, setDisplayed] = useState(value);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    animation.stopAnimation();
    if (reducedMotion) {
      animation.setValue(value);
      previous.current = value;
      return;
    }
    animation.setValue(previous.current);
    const listener = animation.addListener(({ value: next }) =>
      setDisplayed(next),
    );
    Animated.timing(animation, {
      duration: motion.deliberate,
      toValue: value,
      useNativeDriver: false,
    }).start(() => {
      previous.current = value;
      animation.removeListener(listener);
      setDisplayed(value);
    });
    return () => animation.removeListener(listener);
  }, [animation, reducedMotion, value]);

  return (
    <Animated.Text adjustsFontSizeToFit numberOfLines={1} style={style}>
      {formatter(reducedMotion ? value : displayed)}
    </Animated.Text>
  );
}
