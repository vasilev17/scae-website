import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  hotspotPoint,
  ROCKET_HOTSPOTS,
  type RocketHotspotId,
} from '@/lib/rocket-hotspots';

export type RocketHotspotEntry = {
  title: string;
  body: string;
};

export type RocketHotspotCopy = {
  close: string;
  open: string;
} & Record<RocketHotspotId, RocketHotspotEntry>;

type ExhibitHotspotsProps = {
  // The section cut is showing. Markers fade with it.
  open: boolean;
  // Portrait phone: the rocket stands nose-up, so the axis runs vertically.
  portrait: boolean;
  // The exhibit bobs only on a continuous frame loop. Elsewhere the rocket
  // is parked and one layout pass per resize is the whole job.
  bob: boolean;
  copy: RocketHotspotCopy;
};

const CARD_INSET = 8;

function clampCard(root: HTMLElement, pin: HTMLDivElement | undefined) {
  const card = pin?.querySelector('.rocket-hotspot-card');
  if (!(card instanceof HTMLElement) || card.dataset.open !== 'true') return;

  card.style.setProperty('--card-shift-x', '0px');
  card.style.setProperty('--card-shift-y', '0px');

  const box = card.getBoundingClientRect();
  const stage = root.getBoundingClientRect();
  const minX = Math.max(stage.left, CARD_INSET);
  const maxX = Math.min(stage.right, window.innerWidth - CARD_INSET);
  const minY = Math.max(stage.top, CARD_INSET);
  const maxY = Math.min(stage.bottom, window.innerHeight - CARD_INSET);

  let dx = 0;
  let dy = 0;
  if (box.left < minX) dx += minX - box.left;
  if (box.right + dx > maxX) dx += maxX - (box.right + dx);
  if (box.top < minY) dy += minY - box.top;
  if (box.bottom + dy > maxY) dy += maxY - (box.bottom + dy);

  card.style.setProperty('--card-shift-x', `${dx}px`);
  card.style.setProperty('--card-shift-y', `${dy}px`);
}

/**
 * Callout markers pinned to the section cut. They ride the same geometry the
 * x-ray plate does, so a marker sits on its part at any stage size, in either
 * orientation, and through the float.
 */
export function ExhibitHotspots({
  open,
  portrait,
  bob,
  copy,
}: ExhibitHotspotsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pinsRef = useRef(new Map<RocketHotspotId, HTMLDivElement>());
  const [active, setActive] = useState<RocketHotspotId | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  // Which stage quadrant each marker landed in, so its card opens into the
  // free half instead of off the edge. Written by the layout pass.
  const [sides, setSides] = useState<Record<string, string>>({});

  // Toggling the cut drops any open card, so the next section view starts
  // clean. Adjusted in render rather than an effect: no wasted commit.
  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    setActive(null);
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let raf = 0;
    let width = 0;
    let height = 0;

    // Transforms only: the bob runs this every frame, and React has no say
    // in where a marker sits.
    const place = (float: boolean) => {
      if (width === 0 || height === 0) return;
      for (const spot of ROCKET_HOTSPOTS) {
        const pin = pinsRef.current.get(spot.id);
        if (!pin) continue;
        const point = hotspotPoint(spot, width, height, portrait, float);
        pin.style.transform = `translate(${point.x}px, ${point.y}px)`;
      }
      const openId = activeRef.current;
      if (openId) clampCard(root, pinsRef.current.get(openId));
    };

    // Which way each card unfolds. The bob cannot change this, so it is
    // settled once per measure rather than once per frame.
    const flank = () => {
      if (width === 0 || height === 0) return;
      const next: Record<string, string> = {};
      ROCKET_HOTSPOTS.forEach((spot, index) => {
        const point = hotspotPoint(spot, width, height, portrait);
        // Upright, every marker shares one vertical and picking by position
        // would send all six cards the same way. Alternate instead, the way
        // an exploded-view drawing fans its callouts.
        const left = portrait ? index % 2 === 1 : point.x > width * 0.5;
        next[spot.id] =
          (left ? 'left' : 'right') +
          (point.y > height * 0.62 ? '-up' : '-down');
      });
      setSides((prev) => {
        for (const spot of ROCKET_HOTSPOTS) {
          if (prev[spot.id] !== next[spot.id]) return next;
        }
        return prev;
      });
    };

    const measure = () => {
      const box = root.getBoundingClientRect();
      width = box.width;
      height = box.height;
      place(false);
      flank();
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(root);

    // Only a live frame loop moves the rocket off its parked pose.
    if (open && bob) {
      const tick = () => {
        place(true);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [portrait, open, bob]);

  useEffect(() => {
    if (!active) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setActive(null);
    };
    // The layer only takes the pointer on its own markers and cards, so a
    // click anywhere else in the exhibit is a dismiss.
    const onDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setActive(null);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [active]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active) return undefined;
    const frame = requestAnimationFrame(() => {
      clampCard(root, pinsRef.current.get(active));
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div
      ref={rootRef}
      className="rocket-hotspots"
      data-open={open}
      inert={!open}
    >
      {ROCKET_HOTSPOTS.map((spot) => {
        const entry = copy[spot.id];
        const shown = active === spot.id;
        return (
          <div
            key={spot.id}
            ref={(node) => {
              if (node) pinsRef.current.set(spot.id, node);
              else pinsRef.current.delete(spot.id);
            }}
            className="rocket-hotspot"
            data-side={sides[spot.id] ?? 'right-down'}
            data-active={shown}
          >
            <button
              type="button"
              className="rocket-hotspot-dot"
              aria-label={`${copy.open}: ${entry.title}`}
              aria-expanded={shown}
              aria-controls={`rocket-hotspot-${spot.id}`}
              data-active={shown}
              onClick={() => setActive(shown ? null : spot.id)}
            >
              <Plus aria-hidden="true" className="rocket-hotspot-plus" />
            </button>
            <div
              className="rocket-hotspot-card"
              id={`rocket-hotspot-${spot.id}`}
              role="dialog"
              aria-label={entry.title}
              data-open={shown}
              inert={!shown}
            >
              <div className="rocket-hotspot-card-bar">
                <p className="rocket-hotspot-card-title">{entry.title}</p>
                <button
                  type="button"
                  className="rocket-hotspot-card-close"
                  aria-label={copy.close}
                  onClick={() => setActive(null)}
                >
                  <X aria-hidden="true" className="rocket-hotspot-x" />
                </button>
              </div>
              <p className="rocket-hotspot-card-body">{entry.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
