import { useEffect, useRef, type RefObject } from 'react';

import { type PortalState } from '@/lib/rocket-portal';

type DissolveOverlayProps = {
  dissolveRef: RefObject<PortalState>;
  rootRef: RefObject<HTMLDivElement | null>;
};

/**
 * Fullscreen shader hole. Three.js loads after paint so the hero island can
 * SSR. Delete this file + the flag in rocket-portal to drop the effect.
 */
export function DissolveOverlay({ dissolveRef, rootRef }: DissolveOverlayProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = wrapRef.current;
    const root = rootRef.current;
    if (!container || !root) return;

    let cancelled = false;
    let stop = () => {};

    void import('@/components/ui/dissolve-runtime').then(({ mountDissolve }) => {
      if (cancelled) return;
      stop = mountDissolve({ container, dissolveRef, root });
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, [dissolveRef, rootRef]);

  return (
    <div
      ref={wrapRef}
      className="dissolve-overlay"
      aria-hidden="true"
    />
  );
}
