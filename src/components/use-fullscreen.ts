import { useCallback, useEffect, useState } from 'react';

/**
 * Fullscreen via the browser Fullscreen API, for the web app in embed mode.
 * Returns undefined where unsupported (e.g. a framed page whose iframe lacks
 * allow="fullscreen"), so callers simply don't render the button.
 */
export function useFullscreenApi(): { active: boolean; toggle: () => void } | undefined {
  const supported = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const [active, setActive] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = useCallback(() => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    p.catch(e => console.warn('Fullscreen request failed:', e));
  }, []);
  return supported ? { active, toggle } : undefined;
}
