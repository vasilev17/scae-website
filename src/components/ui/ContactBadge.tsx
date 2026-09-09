import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { useQualityBudget } from '@/lib/use-quality-tier';

const BadgeLanyard = lazy(() =>
  import('@/components/ui/BadgeLanyard').then((module) => ({
    default: module.BadgeLanyard,
  })),
);

/** Camera distance that frames the badge across the slot's own height. */
const SLOT_DISTANCE = 11;

type ContactBadgeProps = {
  logoSrc: string;
  alt: string;
  /**
   * Element the scene listens on. The canvas spills past the badge column and
   * passes the pointer through, so events have to come from an ancestor that
   * covers everything the badge can be dragged over.
   */
  pointerSource: RefObject<HTMLElement>;
};

/**
 * Physics badge on a lanyard, with a printed card standing in for readers who
 * opted out of motion. Rapier WASM + the card GLB stay off the critical path:
 * the island lazy-loads once the slot is on screen and freezes once it leaves.
 */
export function ContactBadge({
  logoSrc,
  alt,
  pointerSource,
}: ContactBadgeProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [field, setField] = useState<HTMLDivElement | null>(null);
  const [spread, setSpread] = useState(1);
  const [framed, setFramed] = useState(false);
  const [ready, setReady] = useState(false);
  const [dead, setDead] = useState(false);
  const [grabbable, setGrabbable] = useState(false);
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false);
  const [reduced, setReduced] = useState(true);
  const budget = useQualityBudget();

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting ?? false;
        setInView(visible);
        if (visible) setSeen(true);
      },
      { rootMargin: '20%' },
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  // The canvas is far larger than the slot the layout reserved. Pushing the
  // camera back by the same ratio keeps the badge drawn at the size and place
  // it would have had on a slot-sized canvas, since the two share a centre.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !field) return;

    const sync = () => {
      const base = stage.clientHeight;
      const tall = field.clientHeight;
      if (base <= 0 || tall <= 0) return;
      setSpread(tall / base);
      setFramed(true);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(stage);
    observer.observe(field);
    return () => observer.disconnect();
  }, [field]);

  // Rapier + a third R3F canvas only on `high`. Lower tiers keep the printed
  // card, which is also what reduced-motion readers get.
  const live = seen && !reduced && budget.lanyard && !dead;

  if (!live && (framed || ready || grabbable)) {
    setFramed(false);
    setReady(false);
    setGrabbable(false);
  }

  return (
    <div className="contact-badge" ref={slotRef}>
      <div
        className="contact-badge-stage"
        ref={stageRef}
        data-cursor={grabbable ? 'hover' : undefined}
        role="img"
        aria-label={alt}
      >
        {live ? (
          <BadgeGate onError={() => setDead(true)}>
            <Suspense fallback={null}>
              <div className="contact-badge-field" ref={setField}>
                {framed ? (
                  <BadgeLanyard
                    running={inView}
                    position={[0, 0, SLOT_DISTANCE * spread]}
                    gravity={[0, -40, 0]}
                    pointerSource={pointerSource}
                    onHoverChange={setGrabbable}
                    onReady={() => setReady(true)}
                    onContextLost={() => setDead(true)}
                  />
                ) : null}
              </div>
            </Suspense>
          </BadgeGate>
        ) : null}
        {!live || !ready ? <BadgePoster logoSrc={logoSrc} /> : null}
      </div>
    </div>
  );
}

function BadgePoster({ logoSrc }: { logoSrc: string }) {
  return (
    <div className="contact-badge-poster" aria-hidden="true">
      <span className="contact-badge-poster-strap" />
      <span className="contact-badge-poster-card">
        <img src={logoSrc} alt="" width={512} height={512} />
      </span>
    </div>
  );
}

type BadgeGateProps = {
  children: ReactNode;
  onError: () => void;
};

/**
 * React only reports render errors from a class. A throw inside the lazy
 * Rapier tree would otherwise take the contact form down with it.
 */
class BadgeGate extends Component<BadgeGateProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
