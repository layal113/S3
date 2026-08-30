import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

function readWebPreference() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(readWebPreference);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReducedMotion(enabled || readWebPreference());
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    const media =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.matchMedia?.('(prefers-reduced-motion: reduce)')
        : undefined;
    const updateWebPreference = () => setReducedMotion(media?.matches ?? false);
    media?.addEventListener?.('change', updateWebPreference);
    return () => {
      active = false;
      subscription.remove();
      media?.removeEventListener?.('change', updateWebPreference);
    };
  }, []);

  return reducedMotion;
}
