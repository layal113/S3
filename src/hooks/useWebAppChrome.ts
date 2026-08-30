import { useEffect } from 'react';
import { Platform } from 'react-native';

const STYLE_ID = 'miqyas-web-polish';

export function useWebAppChrome() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const viewport = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
    viewport?.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
    );
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      html, body, #root { width: 100%; min-height: 100%; margin: 0; background: #E9EDEA; }
      html { height: -webkit-fill-available; -webkit-text-size-adjust: 100%; }
      body { min-height: 100dvh; min-height: -webkit-fill-available; overscroll-behavior-y: none; }
      #root { display: flex; min-height: 100dvh; isolation: isolate; }
      *, *::before, *::after { box-sizing: border-box; }
      button, input, textarea { font: inherit; }
      [role="button"], button, a { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      input, textarea { appearance: none; -webkit-appearance: none; border-style: solid; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; }
      }
    `;
  }, []);
}
