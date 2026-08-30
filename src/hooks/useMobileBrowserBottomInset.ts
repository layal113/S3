import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

function readBrowserBottomInset() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 0;
  const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
  const isMobileViewport = window.innerWidth <= 900;
  const viewport = window.visualViewport;
  if (!isMobileViewport || !viewport) return 0;

  const obstruction = Math.max(
    0,
    window.innerHeight - viewport.height - viewport.offsetTop,
  );
  // Ignore large keyboard-sized changes; the navigator hides while the
  // keyboard is open. A small fallback keeps iOS browser chrome comfortable.
  if (obstruction > 150) return 0;
  if (obstruction > 6) return Math.min(88, obstruction + 8);
  return isIOS ? 18 : 0;
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
