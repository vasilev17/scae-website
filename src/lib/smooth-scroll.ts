import Lenis from 'lenis';

let lenis: Lenis | null = null;
let rafId: number | null = null;

const tick = (time: number) => {
  lenis?.raf(time);
  rafId = requestAnimationFrame(tick);
};

/**
 * Page-wide smooth scroll, created on first access. The layout script and any
 * island can both call this in either order and share the one instance.
 *
 * Lenis rides the browser's own scroll, so pinning, sticky, anchors, keyboard
 * navigation and scroll restoration keep working. Reduced motion is handled
 * inside Lenis: smoothing drops out while the instance keeps running, so
 * scroll-driven scenes stay in sync.
 */
export function getSmoothScroll(): Lenis {
  if (lenis) return lenis;

  lenis = new Lenis({
    anchors: true,
    stopInertiaOnNavigate: true,
  });
  startInternalRaf();

  return lenis;
}

/**
 * Hands the frame loop to an external ticker (GSAP's, on pages that animate),
 * so scroll position and scroll-driven tweens settle in the same frame.
 */
export function stopInternalRaf(): void {
  if (rafId === null) return;
  cancelAnimationFrame(rafId);
  rafId = null;
}

export function startInternalRaf(): void {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(tick);
}
