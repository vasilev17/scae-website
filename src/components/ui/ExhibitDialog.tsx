import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { SpecularButton } from '@/components/ui/SpecularButton';
import { getSmoothScroll } from '@/lib/smooth-scroll';

type ExhibitDialogProps = {
  open: boolean;
  origin: { x: number; y: number };
  title: string;
  closeLabel: string;
  dialogId: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
};

const FOCUSABLE =
  'a[href], input, select, textarea, button:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

export function ExhibitDialog({
  open,
  origin,
  title,
  closeLabel,
  dialogId,
  titleId,
  onClose,
  children,
}: ExhibitDialogProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const reduce = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      gsap.set(root, {
        transformOrigin: `${origin.x}px ${origin.y}px`,
      });

      if (reduce) {
        gsap.set(root, { autoAlpha: open ? 1 : 0, scale: 1 });
        return;
      }

      if (open) {
        gsap.set(root, { willChange: 'transform, opacity' });
        gsap.fromTo(
          root,
          { autoAlpha: 0, scale: 0.12 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.55,
            ease: 'power3.out',
            onComplete: () => {
              gsap.set(root, { willChange: 'auto' });
            },
          },
        );
        return;
      }

      gsap.set(root, { willChange: 'transform, opacity' });
      gsap.to(root, {
        autoAlpha: 0,
        scale: 0.12,
        duration: 0.55,
        ease: 'power3.in',
        onComplete: () => {
          gsap.set(root, { willChange: 'auto' });
        },
      });
    },
    {
      scope: rootRef,
      dependencies: [open, origin.x, origin.y],
      revertOnUpdate: false,
    },
  );

  useEffect(() => {
    if (!open) return undefined;

    const root = rootRef.current;
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const lenis = getSmoothScroll();
    lenis.stop();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (node) => !node.hasAttribute('disabled'),
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      lenis.start();
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={rootRef}
      className="mission-overlay"
      data-open={open}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-hidden={!open}
      inert={!open}
      id={dialogId}
    >
      <div className="mission-overlay-bar">
        <p className="mission-overlay-title" id={titleId}>
          {title}
        </p>
        <SpecularButton
          ref={closeRef}
          className="mission-overlay-close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X aria-hidden="true" className="mission-overlay-x" />
        </SpecularButton>
      </div>
      <div className="mission-overlay-stage" data-lenis-prevent>
        {children}
      </div>
    </div>,
    document.body,
  );
}
