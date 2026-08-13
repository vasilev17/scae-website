import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';

import { SpecularButton } from '@/components/ui/SpecularButton';

export type CircularMenuItem = {
  id: string;
  label: string;
  href: string;
};

type CircularMenuProps = {
  open: boolean;
  items: CircularMenuItem[];
  // Accessible name for the menu as a whole.
  label: string;
  closeLabel: string;
  onClose: () => void;
  // Icon at rest in the middle of the joystick.
  centerIconSrc: string;
};

// Everything inside the dial is authored against this square viewBox.
const VIEWBOX = 100;
const CENTER = VIEWBOX / 2;
const INNER_RADIUS = 9;
const OUTER_RADIUS = 42;
const LABEL_RADIUS = 27;
// Trimmed off both ends of a segment so the ring reads as separate keys.
const SEGMENT_GAP = 0.6;

// How far the joystick can be pushed, and how far it counts as pushed.
const DRAG_RANGE = 0.25;
const DRAG_THRESHOLD = 0.8;
// Share of the remaining distance the joystick covers each frame.
const DRAG_FOLLOW = 0.15;

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function polar(radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: round(CENTER + radius * Math.cos(radians)),
    y: round(CENTER + radius * Math.sin(radians)),
  };
}

type Segment = {
  d: string;
  labelX: number;
  labelY: number;
};

function buildSegment(index: number, total: number): Segment {
  const span = 360 / total;
  const start = span * index + SEGMENT_GAP;
  const end = span * (index + 1) - SEGMENT_GAP;
  const innerStart = polar(INNER_RADIUS, start);
  const outerStart = polar(OUTER_RADIUS, start);
  const innerEnd = polar(INNER_RADIUS, end);
  const outerEnd = polar(OUTER_RADIUS, end);
  const largeArc = end - start > 180 ? 1 : 0;
  const label = polar(LABEL_RADIUS, span * index + span / 2);

  return {
    d: [
      `M ${innerStart.x} ${innerStart.y}`,
      `L ${outerStart.x} ${outerStart.y}`,
      `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' '),
    labelX: label.x,
    labelY: label.y,
  };
}

// Which segment a push in this direction points at, counting from the top.
function segmentAt(x: number, y: number, total: number) {
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  const fromTop = (angle + 90 + 360) % 360;
  return Math.floor(fromTop / (360 / total)) % total;
}

/**
 * Fades a set of elements to `to` one after another, each with the stutter of a
 * tube light coming on. Order is shuffled so the ring never lights up the same
 * way twice.
 */
function flicker(segments: Element[], to: number, step: number) {
  const timeline = gsap.timeline();

  gsap.utils.shuffle([...segments.keys()]).forEach((index, position) => {
    const segment = segments[index];
    if (!segment) return;

    timeline.to(
      segment,
      {
        opacity: to,
        duration: step,
        repeat: 3,
        yoyo: true,
        ease: 'power2.inOut',
        // An odd repeat count lands back on the starting value.
        onComplete: () => gsap.set(segment, { opacity: to }),
      },
      position * step,
    );
  });

  return timeline;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Full-screen navigation dial. The caller owns the `open` flag and whatever
 * happens behind it — here that is the gate closing first, which is why this
 * animates in from nothing rather than covering the page itself.
 */
export function CircularMenu({
  open,
  items,
  label,
  closeLabel,
  onClose,
  centerIconSrc,
}: CircularMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const revealedRef = useRef(false);
  const [pushedAt, setPushedAt] = useState<number | null>(null);

  useGSAP(
    () => {
      const segments = gsap.utils.toArray<SVGGElement>(
        '.gate-menu-segment',
        rootRef.current,
      );
      const joystick = joystickRef.current;

      // Nothing to reveal on the first pass, and readers who opted out of
      // motion only ever see the two end states.
      if (!revealedRef.current || prefersReducedMotion()) {
        revealedRef.current = true;
        gsap.set(rootRef.current, { autoAlpha: open ? 1 : 0 });
        gsap.set(segments, { opacity: open ? 1 : 0 });
        gsap.set(joystick, { scale: open ? 1 : 0 });
        return;
      }

      if (open) {
        gsap
          .timeline()
          .to(rootRef.current, { autoAlpha: 1, duration: 0.3 }, 0)
          .add(flicker(segments, 1, 0.075), 0.1)
          .to(
            joystick,
            { scale: 1, duration: 0.4, ease: 'back.out(1.7)' },
            0.25,
          );
        return;
      }

      gsap
        .timeline()
        .add(flicker(segments, 0, 0.05), 0)
        .to(joystick, { scale: 0, duration: 0.3, ease: 'back.in(1.7)' }, 0.1)
        .to(rootRef.current, { autoAlpha: 0, duration: 0.2 }, 0.4);
    },
    { scope: rootRef, dependencies: [open] },
  );

  // Focus lands on the only control that gets the reader back out. The gate
  // navbar behind is hidden by then, so there is nothing else to tab to.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  /**
   * The joystick steers rather than clicks: pushing it toward a segment lights
   * that segment up, releasing lets it spring back.
   */
  useEffect(() => {
    const joystick = joystickRef.current;
    if (!joystick || !open) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const origin = { x: 0, y: 0 };
    let range = 0;
    let dragging = false;
    let frame = 0;

    const step = () => {
      current.x += (target.x - current.x) * DRAG_FOLLOW;
      current.y += (target.y - current.y) * DRAG_FOLLOW;
      gsap.set(joystick, { x: current.x, y: current.y });

      const distance = Math.hypot(current.x, current.y);
      setPushedAt(
        dragging && distance > range * DRAG_THRESHOLD
          ? segmentAt(current.x, current.y, items.length)
          : null,
      );

      if (!dragging && distance < 0.1) {
        gsap.set(joystick, { x: 0, y: 0 });
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(step);
    };

    const wake = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };

    const onPointerDown = (event: PointerEvent) => {
      const rect = joystick.getBoundingClientRect();
      // Measured back off the current offset, so grabbing a joystick that is
      // still springing back does not shift its centre.
      origin.x = rect.left + rect.width / 2 - current.x;
      origin.y = rect.top + rect.height / 2 - current.y;
      range = rect.width * DRAG_RANGE;
      dragging = true;
      joystick.setPointerCapture(event.pointerId);
      event.preventDefault();
      wake();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;

      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= range * DRAG_THRESHOLD) {
        target.x = 0;
        target.y = 0;
      } else if (distance > range) {
        target.x = (dx / distance) * range;
        target.y = (dy / distance) * range;
      } else {
        target.x = dx;
        target.y = dy;
      }
    };

    const onPointerUp = () => {
      dragging = false;
      target.x = 0;
      target.y = 0;
      wake();
    };

    joystick.addEventListener('pointerdown', onPointerDown);
    joystick.addEventListener('pointermove', onPointerMove);
    joystick.addEventListener('pointerup', onPointerUp);
    joystick.addEventListener('pointercancel', onPointerUp);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      joystick.removeEventListener('pointerdown', onPointerDown);
      joystick.removeEventListener('pointermove', onPointerMove);
      joystick.removeEventListener('pointerup', onPointerUp);
      joystick.removeEventListener('pointercancel', onPointerUp);
      gsap.set(joystick, { x: 0, y: 0 });
      setPushedAt(null);
    };
  }, [open, items.length]);

  return (
    <div
      ref={rootRef}
      id="gate-menu"
      className="gate-menu"
      data-open={open}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="gate-menu-stage">
        <div className="gate-menu-close-slot">
          <SpecularButton
            ref={closeRef}
            className="gate-menu-close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="gate-menu-x">
              <path d="M3 3 L13 13 M13 3 L3 13" />
            </svg>
          </SpecularButton>
        </div>

        <nav className="gate-menu-dial" aria-label={label}>
          <svg
            className="gate-menu-svg"
            viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
            role="presentation"
          >
            {items.map((item, index) => {
              const segment = buildSegment(index, items.length);
              return (
                <a
                  key={item.id}
                  className="gate-menu-segment"
                  href={item.href}
                  data-pushed={pushedAt === index}
                >
                  <path className="gate-menu-shape" d={segment.d} />
                  <text
                    className="gate-menu-index"
                    x={segment.labelX}
                    y={segment.labelY - 3}
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </text>
                  <text
                    className="gate-menu-label"
                    x={segment.labelX}
                    y={segment.labelY + 2}
                  >
                    {item.label}
                  </text>
                </a>
              );
            })}
          </svg>

          <div className="gate-menu-joystick-slot" aria-hidden="true">
            <div ref={joystickRef} className="gate-menu-joystick">
              <img
                src={centerIconSrc}
                alt=""
                className="gate-menu-joystick-icon"
              />
              {(['up', 'down', 'left', 'right'] as const).map((direction) => (
                <svg
                  key={direction}
                  viewBox="0 0 12 8"
                  className={`gate-menu-hint gate-menu-hint--${direction}`}
                >
                  <path d="M1 6.5 L6 1.5 L11 6.5" />
                </svg>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
