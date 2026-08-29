import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

function readBrowserBottomInset() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 0;
  const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
  const viewport = window.visualViewport;
  if (!isIOS || !viewport) return 0;

  // Safari's bottom address/search bar can cover the layout viewport. Capping
  // the value prevents the on-screen keyboard from being mistaken for it.
  return Math.max(
    56,
    Math.min(
      90,
      Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop),
    ),
  );
}

export function useMobileBrowserBottomInset() {
  const [bottomInset, setBottomInset] = useState(readBrowserBottomInset);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => setBottomInset(readBrowserBottomInset());
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return bottomInset;
}
