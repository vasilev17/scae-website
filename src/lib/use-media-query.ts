import { useCallback, useSyncExternalStore } from 'react';

/**
 * Live `matchMedia` result. Server and hydration renders report `fallback`
 * so the markup agrees with the server, then the first client render swaps in
 * the real answer without a mismatch.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  const read = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, read, () => fallback);
}
