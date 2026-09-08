import { lazy, Suspense, useEffect, useRef, useState } from 'react';

const BadgeLanyard = lazy(() =>
  import('@/components/ui/BadgeLanyard').then((module) => ({
    default: module.BadgeLanyard,
  })),
);

type ContactBadgeProps = {
  logoSrc: string;
  alt: string;
};

/**
 * Physics badge on a lanyard, with a printed card standing in for readers who
 * opted out of motion. Rapier WASM + the card GLB stay off the critical path:
 * the island lazy-loads once the slot is on screen and freezes once it leaves.
 */
export function ContactBadge({ logoSrc, alt }: ContactBadgeProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false);
  const [reduced, setReduced] = useState(true);

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

  const live = seen && !reduced;

  return (
    <div className="contact-badge" ref={slotRef}>
      <div
        className="contact-badge-stage"
        data-cursor={live ? 'hover' : undefined}
        role="img"
        aria-label={alt}
      >
        {live ? (
          <Suspense fallback={<BadgePoster logoSrc={logoSrc} />}>
            <BadgeLanyard
              running={inView}
              position={[0, 0, 11]}
              gravity={[0, -40, 0]}
            />
          </Suspense>
        ) : (
          <BadgePoster logoSrc={logoSrc} />
        )}
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
