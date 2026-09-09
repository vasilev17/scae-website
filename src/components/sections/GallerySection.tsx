import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';

import { GalleryOverlay } from '@/components/ui/GalleryOverlay';
import { PixelatedCanvas } from '@/components/ui/PixelatedCanvas';
import type { UiDictionary } from '@/i18n/ui/en';
import { useQualityBudget } from '@/lib/use-quality-tier';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export type GalleryCopy = UiDictionary['gallery'];

export type GalleryImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type GallerySectionProps = {
  copy: GalleryCopy;
  logoSrc: string;
  images: GalleryImage[];
};

type CardPair = {
  left: HTMLElement;
  right: HTMLElement;
  travel: (typeof CARD_TRAVEL)[number];
};

type OverlayOrigin = { x: number; y: number };

const CARD_TRAVEL = [
  { leftX: -800, rightX: 800, leftRot: -30, rightRot: 30, y: 100 },
  { leftX: -900, rightX: 900, leftRot: -20, rightRot: 20, y: -150 },
  { leftX: -400, rightX: 400, leftRot: -35, rightRot: 35, y: -400 },
] as const;

function pairImages(images: GalleryImage[]): [GalleryImage, GalleryImage][] {
  const pairs: [GalleryImage, GalleryImage][] = [];
  for (let i = 0; i + 1 < images.length; i += 2) {
    const left = images[i];
    const right = images[i + 1];
    if (left && right) pairs.push([left, right]);
  }
  return pairs;
}

function travelScale() {
  return {
    x: Math.min(window.innerWidth / 1200, 1),
    y: Math.min(window.innerHeight / 900, 1),
  };
}

function poseCards(pairs: CardPair[], progress: number) {
  const scale = travelScale();
  for (const pair of pairs) {
    gsap.set(pair.left, {
      x: progress * pair.travel.leftX * scale.x,
      y: progress * pair.travel.y * scale.y,
      rotation: progress * pair.travel.leftRot,
    });
    gsap.set(pair.right, {
      x: progress * pair.travel.rightX * scale.x,
      y: progress * pair.travel.y * scale.y,
      rotation: progress * pair.travel.rightRot,
    });
  }
}

export function GallerySection({ copy, logoSrc, images }: GallerySectionProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [origin, setOrigin] = useState<OverlayOrigin>({ x: 0, y: 0 });
  const rows = pairImages(images);
  const budget = useQualityBudget();

  const closeTimer = useRef(0);

  const openOverlay = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    window.clearTimeout(closeTimer.current);
    setOrigin({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setOverlayMounted(true);
    setOverlayOpen(true);
  }, []);

  const closeOverlay = useCallback(() => {
    setOverlayOpen(false);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOverlayMounted(false), 580);
  }, []);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const media = gsap.matchMedia(root);
      media.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          animate: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          if (context.conditions?.reduce) {
            gsap.set('.gallery-logo', { scale: 1 });
            gsap.set('.gallery-body', { y: 0, autoAlpha: 1 });
            gsap.set('.gallery-cta', { y: 0, autoAlpha: 1 });
            return;
          }

          const pairs: CardPair[] = [];
          gsap.utils
            .toArray<HTMLElement>('.gallery-row')
            .forEach((row, index) => {
              const travel = CARD_TRAVEL[index % CARD_TRAVEL.length];
              const left = row.querySelector('.gallery-card-left');
              const right = row.querySelector('.gallery-card-right');
              if (!travel || !(left instanceof HTMLElement)) return;
              if (!(right instanceof HTMLElement)) return;
              pairs.push({ left, right, travel });
            });

          poseCards(pairs, 0);

          ScrollTrigger.create({
            id: 'gallery-scrub',
            trigger: root,
            start: 'top center',
            end: '150% bottom',
            scrub: true,
            invalidateOnRefresh: true,
            onRefresh: (self) => poseCards(pairs, self.progress),
            onUpdate: (self) => poseCards(pairs, self.progress),
            onToggle: (self) => {
              gsap.set('.gallery-card', {
                willChange: self.isActive ? 'transform' : 'auto',
              });
            },
          });

          gsap
            .timeline({
              scrollTrigger: {
                id: 'gallery-reveal',
                trigger: root,
                start: 'top 25%',
                toggleActions: 'play reverse play reverse',
              },
            })
            .fromTo(
              '.gallery-logo',
              { scale: 0 },
              { scale: 1, duration: 0.5, ease: 'power1.out' },
              0,
            )
            .fromTo(
              '.gallery-body',
              { y: 30, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power1.out' },
              0.1,
            )
            .fromTo(
              '.gallery-cta',
              { y: 30, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power1.out' },
              0.25,
            );
        },
      );
    },
    { scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      className="gallery"
      id="gallery"
      aria-labelledby="gallery-title"
    >
      <div className="gallery-content">
        <div className="gallery-logo">
          <PixelatedCanvas
            src={logoSrc}
            alt={copy.logoAlt}
            className="gallery-logo-canvas"
            responsive
            cellSize={3}
            dotScale={0.9}
            shape="circle"
            dropoutStrength={0}
            interactive={budget.pixelLoop}
            imageScale={0.78}
            imageOffsetX={-0.024}
            imageOffsetY={0.009}
            distortionStrength={1.5}
            distortionRadius={18}
            distortionMode="repel"
            followSpeed={0.2}
            jitterStrength={budget.pixelLoop ? 7.5 : 0}
            jitterSpeed={4}
            sampleAverage
            objectFit="contain"
            tintStrength={0.15}
          />
        </div>
        <h2 className="gallery-title" id="gallery-title">
          {copy.title}
        </h2>
        <p className="gallery-body">{copy.body}</p>
        <div className="gallery-btn">
          <button
            className="gallery-cta"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={overlayOpen}
            onClick={openOverlay}
          >
            {copy.cta}
          </button>
        </div>
      </div>

      {rows.map(([left, right]) => (
        <div className="gallery-row" key={left.src}>
          <div className="gallery-card gallery-card-left">
            <img
              src={left.src}
              alt={left.alt}
              width={left.width}
              height={left.height}
            />
          </div>
          <div className="gallery-card gallery-card-right">
            <img
              src={right.src}
              alt={right.alt}
              width={right.width}
              height={right.height}
            />
          </div>
        </div>
      ))}

      {overlayMounted ? (
        <GalleryOverlay
          open={overlayOpen}
          origin={origin}
          title={copy.title}
          closeLabel={copy.close}
          images={images}
          onClose={closeOverlay}
        />
      ) : null}
    </section>
  );
}
