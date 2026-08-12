import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef, type CSSProperties } from 'react';

gsap.registerPlugin(useGSAP);

type GateRevealProps = {
  // Baked metal texture, laid over each pane's gradient.
  metalSrc: string;
  logoSrc: string;
  // Total length of the reveal, in seconds.
  duration?: number;
};

/**
 * Phase boundaries as fractions of the total duration. The panes hold shut,
 * crack open fast as if unsticking, stall, then travel clear of the viewport at
 * a steady pace before easing back to their resting positions.
 */
const PHASES = {
  crackStart: 0.06,
  crackDuration: 0.12,
  openStart: 0.25,
  openDuration: 0.37,
  settleStart: 0.67,
  settleDuration: 0.45,
} as const;

// How far the first fast crack travels, as a percentage of viewport height.
const CRACK_TRAVEL = 8;
// Extra travel past the viewport edge, so each pane is fully out of sight.
const CLEARANCE = 4;

/**
 * Reads one of the geometry custom properties from the gate's stylesheet. They
 * are authored in `cqh` against the overlay, which is exactly the viewport, so
 * their numeric part can be used directly as a GSAP `yPercent`.
 */
function readGeometry(root: Element, name: string): number {
  return parseFloat(getComputedStyle(root).getPropertyValue(name));
}

export function GateReveal({
  metalSrc,
  logoSrc,
  duration = 2.6,
}: GateRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const seam = readGeometry(root, '--gate-seam');
      const notch = readGeometry(root, '--gate-notch');
      const overlap = readGeometry(root, '--gate-seam-overlap');
      const restVisibleTop = readGeometry(root, '--gate-rest-visible-top');
      const restVisibleBottom = readGeometry(
        root,
        '--gate-rest-visible-bottom',
      );

      const paneDepthTop = seam + notch;
      const paneDepthBottom = seam - overlap + notch;

      const openTop = -(seam + notch + CLEARANCE);
      const openBottom = 100 - seam + CLEARANCE;
      const restTop = restVisibleTop - paneDepthTop;
      const restBottom = 100 - paneDepthBottom - restVisibleBottom;

      /** Picks a value per pane without depending on paint order. */
      const perPane =
        (top: number, bottom: number) => (_index: number, pane: Element) =>
          pane.classList.contains('gate-pane-group--top') ? top : bottom;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set('.gate-pane-group', {
          yPercent: perPane(restTop, restBottom),
          willChange: 'auto',
        });
        gsap.set('.gate-logo', { autoAlpha: 0 });
        return;
      }

      gsap
        .timeline()
        .to(
          '.gate-pane-group',
          {
            yPercent: perPane(-CRACK_TRAVEL, CRACK_TRAVEL),
            duration: duration * PHASES.crackDuration,
            ease: 'power4.out',
          },
          duration * PHASES.crackStart,
        )
        .to(
          '.gate-pane-group',
          {
            yPercent: perPane(openTop, openBottom),
            duration: duration * PHASES.openDuration,
            ease: 'power1.inOut',
          },
          duration * PHASES.openStart,
        )
        .set(
          '.gate-logo',
          { autoAlpha: 0 },
          duration * (PHASES.openStart + PHASES.openDuration),
        )
        .to(
          '.gate-pane-group',
          {
            yPercent: perPane(restTop, restBottom),
            duration: duration * PHASES.settleDuration,
            ease: 'power2.out',
          },
          duration * PHASES.settleStart,
        )
        .set('.gate-pane-group', { willChange: 'auto' });
    },
    { scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className="gate-reveal pointer-events-none fixed inset-0 z-50"
      style={{ '--gate-metal': `url("${metalSrc}")` } as CSSProperties}
      aria-hidden="true"
    >
      <div className="gate-pane-group gate-pane-group--bottom">
        <div className="gate-pane-shadow">
          <div className="gate-pane gate-pane--bottom"></div>
        </div>
        <img src={logoSrc} alt="" className="gate-logo gate-logo--bottom" />
      </div>
      <div className="gate-pane-group gate-pane-group--top">
        <div className="gate-pane-shadow">
          <div className="gate-pane gate-pane--top"></div>
        </div>
        <img
          src={logoSrc}
          alt=""
          className="gate-logo gate-logo--top"
          fetchPriority="high"
        />
      </div>
    </div>
  );
}
