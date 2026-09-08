import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { SpecularButton } from '@/components/ui/SpecularButton';
import { getSmoothScroll } from '@/lib/smooth-scroll';

type GalleryImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type GalleryOverlayProps = {
  open: boolean;
  origin: { x: number; y: number };
  title: string;
  closeLabel: string;
  images: GalleryImage[];
  onClose: () => void;
};

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function GalleryOverlay({
  open,
  origin,
  title,
  closeLabel,
  images,
  onClose,
}: GalleryOverlayProps) {
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
        gsap.set('.gallery-overlay-item', { autoAlpha: 1, y: 0 });
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
        gsap.fromTo(
          '.gallery-overlay-item',
          { y: 24, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.4,
            stagger: 0.05,
            delay: 0.18,
            ease: 'power2.out',
          },
        );
        return;
      }

      gsap.to(root, {
        autoAlpha: 0,
        scale: 0.94,
        duration: 0.28,
        ease: 'power2.in',
      });
    },
    { scope: rootRef, dependencies: [open, origin.x, origin.y] },
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
      const items = [
        ...root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter((node) => !node.hasAttribute('disabled'));
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
      className="gallery-overlay"
      data-open={open}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-overlay-title"
      aria-hidden={!open}
      inert={!open}
    >
      <div className="gallery-overlay-bar">
        <p className="gallery-overlay-title" id="gallery-overlay-title">
          {title}
        </p>
        <SpecularButton
          ref={closeRef}
          className="gallery-overlay-close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X aria-hidden="true" className="gallery-overlay-x" />
        </SpecularButton>
      </div>
      <div className="gallery-overlay-grid">
        {images.map((image) => (
          <figure className="gallery-overlay-item" key={image.src}>
            <img
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
            />
          </figure>
        ))}
      </div>
    </div>,
    document.body,
  );
}
