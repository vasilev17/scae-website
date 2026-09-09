import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { SpecularButton } from '@/components/ui/SpecularButton';
import { getSmoothScroll } from '@/lib/smooth-scroll';

const DomeGallery = lazy(async () => {
  const mod = await import('@/components/ui/DomeGallery');
  return { default: mod.DomeGallery };
});

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
  'a[href], input, select, textarea, button:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

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
        if (root?.querySelector('[data-enlarging="true"]')) return;
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

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return createPortal(
    <div
      ref={rootRef}
      className="gallery-overlay"
      data-open={open}
      data-mode={reduceMotion ? 'grid' : 'dome'}
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
      <div className="gallery-overlay-stage">
        {reduceMotion ? (
          <div className="gallery-overlay-grid" data-lenis-prevent>
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
        ) : (
          <Suspense fallback={null}>
            <DomeGallery
              images={images}
              fit={0.7}
              minRadius={650}
              maxVerticalRotationDeg={5}
              segments={30}
              dragDampening={2.4}
              grayscale={false}
            />
          </Suspense>
        )}
      </div>
    </div>,
    document.body,
  );
}
