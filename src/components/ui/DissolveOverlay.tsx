import { useEffect, useRef, type RefObject } from 'react';

import { type PortalState } from '@/lib/rocket-portal';

type DissolveOverlayProps = {
  dissolveRef: RefObject<PortalState>;
  rootRef: RefObject<HTMLDivElement | null>;
  active: boolean;
};

export function DissolveOverlay({
  dissolveRef,
  rootRef,
  active,
}: DissolveOverlayProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = wrapRef.current;
    const root = rootRef.current;
    if (!container || !root || !active) return;

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
  }, [dissolveRef, rootRef, active]);

  return (
    <div
      ref={wrapRef}
      className="dissolve-overlay"
      aria-hidden="true"
    />
  );
}
