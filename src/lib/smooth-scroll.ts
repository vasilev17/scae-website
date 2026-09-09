import Lenis from 'lenis';

let lenis: Lenis | null = null;
let rafId: number | null = null;

const tick = (time: number) => {
  lenis?.raf(time);
  rafId = requestAnimationFrame(tick);
};

export function getSmoothScroll(): Lenis {
  if (lenis) return lenis;

  lenis = new Lenis({
    anchors: true,
    stopInertiaOnNavigate: true,
  });
  startInternalRaf();

  return lenis;
}

export function stopInternalRaf(): void {
  if (rafId === null) return;
  cancelAnimationFrame(rafId);
  rafId = null;
}

export function startInternalRaf(): void {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(tick);
}
