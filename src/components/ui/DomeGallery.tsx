// Source: https://reactbits.dev/components/dome-gallery  Adapted: 2026-09-08

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useGesture } from '@use-gesture/react';

export type DomeImage = {
  src: string;
  alt: string;
};

type DomeGalleryProps = {
  images: DomeImage[];
  fit?: number;
  fitBasis?: 'auto' | 'min' | 'max' | 'width' | 'height';
  minRadius?: number;
  maxRadius?: number;
  padFactor?: number;
  overlayBlurColor?: string;
  maxVerticalRotationDeg?: number;
  dragSensitivity?: number;
  enlargeTransitionMs?: number;
  segments?: number;
  dragDampening?: number;
  openedImageWidth?: string;
  openedImageHeight?: string;
  imageBorderRadius?: string;
  openedImageBorderRadius?: string;
  grayscale?: boolean;
};

type ItemDef = DomeImage & {
  x: number;
  y: number;
  sizeX: number;
  sizeY: number;
};

type PointerKind = 'mouse' | 'pen' | 'touch';

type RootStyle = CSSProperties & {
  '--segments-x': number;
  '--segments-y': number;
  '--overlay-blur-color': string;
  '--tile-radius': string;
  '--enlarge-radius': string;
  '--image-filter': string;
};

type ItemStyle = CSSProperties & {
  '--offset-x': number;
  '--offset-y': number;
  '--item-size-x': number;
  '--item-size-y': number;
};

const DEFAULTS = {
  maxVerticalRotationDeg: 5,
  dragSensitivity: 20,
  enlargeTransitionMs: 300,
  segments: 35,
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);
const normalizeAngle = (d: number) => ((d % 360) + 360) % 360;
const wrapAngleSigned = (deg: number) => {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a - 180;
};

const getDataNumber = (el: HTMLElement, name: string, fallback: number) => {
  const attr = el.dataset[name] ?? el.getAttribute(`data-${name}`);
  const n = attr == null ? Number.NaN : parseFloat(attr);
  return Number.isFinite(n) ? n : fallback;
};

function pointerKind(event: Event): PointerKind {
  if (!(event instanceof PointerEvent)) return 'mouse';
  if (event.pointerType === 'pen' || event.pointerType === 'touch') {
    return event.pointerType;
  }
  return 'mouse';
}

function buildItems(pool: DomeImage[], seg: number): ItemDef[] {
  const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2);
  const evenYs = [-4, -2, 0, 2, 4];
  const oddYs = [-3, -1, 1, 3, 5];

  const coords = xCols.flatMap((x, c) => {
    const ys = c % 2 === 0 ? evenYs : oddYs;
    return ys.map((y) => ({ x, y, sizeX: 2, sizeY: 2 }));
  });

  const totalSlots = coords.length;
  if (pool.length === 0) {
    return coords.map((c) => ({ ...c, src: '', alt: '' }));
  }

  const usedImages = Array.from(
    { length: totalSlots },
    (_, i) => pool[i % pool.length] ?? { src: '', alt: '' },
  );

  for (let i = 1; i < usedImages.length; i++) {
    const current = usedImages[i];
    const previous = usedImages[i - 1];
    if (!current || !previous || current.src !== previous.src) continue;
    for (let j = i + 1; j < usedImages.length; j++) {
      const swap = usedImages[j];
      if (swap && swap.src !== current.src) {
        usedImages[i] = swap;
        usedImages[j] = current;
        break;
      }
    }
  }

  return coords.map((c, i) => {
    const image = usedImages[i] ?? { src: '', alt: '' };
    return {
      ...c,
      src: image.src,
      alt: image.alt,
    };
  });
}

function computeItemBaseRotation(
  offsetX: number,
  offsetY: number,
  sizeX: number,
  sizeY: number,
  segments: number,
) {
  const unit = 360 / segments / 2;
  const rotateY = unit * (offsetX + (sizeX - 1) / 2);
  const rotateX = unit * (offsetY - (sizeY - 1) / 2);
  return { rotateX, rotateY };
}

function uniqueCaptions(images: DomeImage[]): DomeImage[] {
  const seen = new Set<string>();
  const out: DomeImage[] = [];
  for (const image of images) {
    if (seen.has(image.src)) continue;
    seen.add(image.src);
    out.push(image);
  }
  return out;
}

export function DomeGallery({
  images,
  fit = 0.5,
  fitBasis = 'auto',
  minRadius = 600,
  maxRadius = Infinity,
  padFactor = 0.25,
  overlayBlurColor = 'var(--color-void)',
  maxVerticalRotationDeg = DEFAULTS.maxVerticalRotationDeg,
  dragSensitivity = DEFAULTS.dragSensitivity,
  enlargeTransitionMs = DEFAULTS.enlargeTransitionMs,
  segments = DEFAULTS.segments,
  dragDampening = 2,
  openedImageWidth = '25rem',
  openedImageHeight = '25rem',
  imageBorderRadius = '1.875rem',
  openedImageBorderRadius = '1.875rem',
  grayscale = true,
}: DomeGalleryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const sphereRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const focusedElRef = useRef<HTMLElement | null>(null);
  const originalTilePositionRef = useRef<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const rotationRef = useRef({ x: 0, y: 0 });
  const startRotRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const cancelTapRef = useRef(false);
  const movedRef = useRef(false);
  const inertiaRAF = useRef<number | null>(null);
  const pointerTypeRef = useRef<PointerKind>('mouse');
  const tapTargetRef = useRef<HTMLElement | null>(null);
  const openingRef = useRef(false);
  const openStartedAtRef = useRef(0);
  const lastDragEndAt = useRef(0);
  const lockedRadiusRef = useRef<number | null>(null);

  const items = useMemo(() => buildItems(images, segments), [images, segments]);
  const captions = useMemo(() => uniqueCaptions(images), [images]);

  const applyTransform = (xDeg: number, yDeg: number) => {
    const el = sphereRef.current;
    if (el) {
      el.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
    }
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const cr = entry.contentRect;
      const w = Math.max(1, cr.width);
      const h = Math.max(1, cr.height);
      const minDim = Math.min(w, h);
      const maxDim = Math.max(w, h);
      const aspect = w / h;
      let basis: number;
      switch (fitBasis) {
        case 'min':
          basis = minDim;
          break;
        case 'max':
          basis = maxDim;
          break;
        case 'width':
          basis = w;
          break;
        case 'height':
          basis = h;
          break;
        default:
          basis = aspect >= 1.3 ? w : minDim;
      }
      let radius = basis * fit;
      radius = Math.min(radius, h * 1.35);
      radius = clamp(radius, minRadius, maxRadius);
      lockedRadiusRef.current = Math.round(radius);

      const viewerPad = Math.max(8, Math.round(minDim * padFactor));
      root.style.setProperty('--radius', `${lockedRadiusRef.current}px`);
      root.style.setProperty('--viewer-pad', `${viewerPad}px`);
      root.style.setProperty('--overlay-blur-color', overlayBlurColor);
      root.style.setProperty('--tile-radius', imageBorderRadius);
      root.style.setProperty('--enlarge-radius', openedImageBorderRadius);
      root.style.setProperty(
        '--image-filter',
        grayscale ? 'grayscale(1)' : 'none',
      );
      applyTransform(rotationRef.current.x, rotationRef.current.y);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [
    fit,
    fitBasis,
    minRadius,
    maxRadius,
    padFactor,
    overlayBlurColor,
    grayscale,
    imageBorderRadius,
    openedImageBorderRadius,
  ]);

  useEffect(() => {
    applyTransform(rotationRef.current.x, rotationRef.current.y);
  }, []);

  const stopInertia = useCallback(() => {
    if (inertiaRAF.current) {
      cancelAnimationFrame(inertiaRAF.current);
      inertiaRAF.current = null;
    }
  }, []);

  const startInertia = useCallback(
    (vx: number, vy: number) => {
      const reduce = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      if (reduce) return;

      const MAX_V = 1.4;
      let vX = clamp(vx, -MAX_V, MAX_V) * 80;
      let vY = clamp(vy, -MAX_V, MAX_V) * 80;
      let frames = 0;
      const d = clamp(dragDampening ?? 0.6, 0, 1);
      const frictionMul = 0.94 + 0.055 * d;
      const stopThreshold = 0.015 - 0.01 * d;
      const maxFrames = Math.round(90 + 270 * d);
      const step = () => {
        vX *= frictionMul;
        vY *= frictionMul;
        if (Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold) {
          inertiaRAF.current = null;
          return;
        }
        if (++frames > maxFrames) {
          inertiaRAF.current = null;
          return;
        }
        const nextX = clamp(
          rotationRef.current.x - vY / 200,
          -maxVerticalRotationDeg,
          maxVerticalRotationDeg,
        );
        const nextY = wrapAngleSigned(rotationRef.current.y + vX / 200);
        rotationRef.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
        inertiaRAF.current = requestAnimationFrame(step);
      };
      stopInertia();
      inertiaRAF.current = requestAnimationFrame(step);
    },
    [dragDampening, maxVerticalRotationDeg, stopInertia],
  );

  useEffect(() => () => stopInertia(), [stopInertia]);

  const openItemFromElement = useCallback(
    (el: HTMLElement) => {
      if (openingRef.current) return;
      openingRef.current = true;
      openStartedAtRef.current = performance.now();
      const parent = el.parentElement;
      if (!parent) {
        openingRef.current = false;
        return;
      }
      focusedElRef.current = el;
      el.setAttribute('data-focused', 'true');
      const offsetX = getDataNumber(parent, 'offsetX', 0);
      const offsetY = getDataNumber(parent, 'offsetY', 0);
      const sizeX = getDataNumber(parent, 'sizeX', 2);
      const sizeY = getDataNumber(parent, 'sizeY', 2);
      const parentRot = computeItemBaseRotation(
        offsetX,
        offsetY,
        sizeX,
        sizeY,
        segments,
      );
      const parentY = normalizeAngle(parentRot.rotateY);
      const globalY = normalizeAngle(rotationRef.current.y);
      let rotY = -(parentY + globalY) % 360;
      if (rotY < -180) rotY += 360;
      const rotX = -parentRot.rotateX - rotationRef.current.x;
      parent.style.setProperty('--rot-y-delta', `${rotY}deg`);
      parent.style.setProperty('--rot-x-delta', `${rotX}deg`);
      const refDiv = document.createElement('div');
      refDiv.className = 'dome-gallery-tile dome-gallery-tile--ref';
      refDiv.style.transform = `rotateX(${-parentRot.rotateX}deg) rotateY(${-parentRot.rotateY}deg)`;
      parent.appendChild(refDiv);

      void refDiv.offsetHeight;

      const tileR = refDiv.getBoundingClientRect();
      const mainR = mainRef.current?.getBoundingClientRect();
      const frameR = frameRef.current?.getBoundingClientRect();

      if (!mainR || !frameR || tileR.width <= 0 || tileR.height <= 0) {
        openingRef.current = false;
        focusedElRef.current = null;
        parent.removeChild(refDiv);
        return;
      }

      originalTilePositionRef.current = {
        left: tileR.left,
        top: tileR.top,
        width: tileR.width,
        height: tileR.height,
      };
      el.style.visibility = 'hidden';
      el.style.zIndex = '0';
      const overlay = document.createElement('div');
      overlay.className = 'dome-gallery-enlarge';
      overlay.style.left = `${frameR.left - mainR.left}px`;
      overlay.style.top = `${frameR.top - mainR.top}px`;
      overlay.style.width = `${frameR.width}px`;
      overlay.style.height = `${frameR.height}px`;
      overlay.style.borderRadius = openedImageBorderRadius;
      overlay.style.transition = `transform ${enlargeTransitionMs}ms ease, opacity ${enlargeTransitionMs}ms ease`;
      const rawSrc = parent.dataset.src || el.querySelector('img')?.src || '';
      const rawAlt = parent.dataset.alt || el.querySelector('img')?.alt || '';
      const img = document.createElement('img');
      img.src = rawSrc;
      img.alt = rawAlt;
      img.draggable = false;
      overlay.appendChild(img);
      viewerRef.current?.appendChild(overlay);
      const tx0 = tileR.left - frameR.left;
      const ty0 = tileR.top - frameR.top;
      const sx0 = tileR.width / frameR.width;
      const sy0 = tileR.height / frameR.height;
      const validSx0 = Number.isFinite(sx0) && sx0 > 0 ? sx0 : 1;
      const validSy0 = Number.isFinite(sy0) && sy0 > 0 ? sy0 : 1;

      overlay.style.transform = `translate(${tx0}px, ${ty0}px) scale(${validSx0}, ${validSy0})`;
      const reduce = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const reveal = () => {
        if (!overlay.parentElement) return;
        overlay.style.opacity = '1';
        overlay.style.transform = 'translate(0px, 0px) scale(1, 1)';
        rootRef.current?.setAttribute('data-enlarging', 'true');
      };
      if (reduce) {
        reveal();
      } else {
        window.setTimeout(reveal, 16);
      }
    },
    [enlargeTransitionMs, openedImageBorderRadius, segments],
  );

  useGesture(
    {
      onDragStart: ({ event }) => {
        if (focusedElRef.current) return;
        stopInertia();

        const evt = event instanceof PointerEvent ? event : null;
        if (!evt) return;
        pointerTypeRef.current = pointerKind(evt);
        if (pointerTypeRef.current === 'touch') evt.preventDefault();
        draggingRef.current = true;
        cancelTapRef.current = false;
        movedRef.current = false;
        startRotRef.current = { ...rotationRef.current };
        startPosRef.current = { x: evt.clientX, y: evt.clientY };
        const potential =
          evt.target instanceof Element
            ? evt.target.closest('.dome-gallery-tile')
            : null;
        tapTargetRef.current =
          potential instanceof HTMLElement &&
          !potential.classList.contains('dome-gallery-tile--ref')
            ? potential
            : null;
      },
      onDrag: ({
        event,
        last,
        velocity: velArr = [0, 0],
        direction: dirArr = [0, 0],
        movement,
      }) => {
        if (
          focusedElRef.current ||
          !draggingRef.current ||
          !startPosRef.current
        )
          return;

        const evt = event instanceof PointerEvent ? event : null;
        if (!evt) return;
        if (pointerTypeRef.current === 'touch') evt.preventDefault();

        const dxTotal = evt.clientX - startPosRef.current.x;
        const dyTotal = evt.clientY - startPosRef.current.y;

        if (!movedRef.current) {
          const dist2 = dxTotal * dxTotal + dyTotal * dyTotal;
          if (dist2 > 16) movedRef.current = true;
        }

        const nextX = clamp(
          startRotRef.current.x - dyTotal / dragSensitivity,
          -maxVerticalRotationDeg,
          maxVerticalRotationDeg,
        );
        const nextY = startRotRef.current.y + dxTotal / dragSensitivity;

        const cur = rotationRef.current;
        if (cur.x !== nextX || cur.y !== nextY) {
          rotationRef.current = { x: nextX, y: nextY };
          applyTransform(nextX, nextY);
        }

        if (last) {
          draggingRef.current = false;
          let isTap = false;

          const dx = evt.clientX - startPosRef.current.x;
          const dy = evt.clientY - startPosRef.current.y;
          const dist2 = dx * dx + dy * dy;
          const TAP_THRESH_PX = pointerTypeRef.current === 'touch' ? 10 : 6;
          if (dist2 <= TAP_THRESH_PX * TAP_THRESH_PX) {
            isTap = true;
          }

          const [vMagX = 0, vMagY = 0] = velArr;
          const [dirX = 0, dirY = 0] = dirArr;
          let vx = vMagX * dirX;
          let vy = vMagY * dirY;

          if (
            !isTap &&
            Math.abs(vx) < 0.001 &&
            Math.abs(vy) < 0.001 &&
            Array.isArray(movement)
          ) {
            const [mx = 0, my = 0] = movement;
            vx = (mx / dragSensitivity) * 0.02;
            vy = (my / dragSensitivity) * 0.02;
          }

          if (!isTap && (Math.abs(vx) > 0.005 || Math.abs(vy) > 0.005)) {
            startInertia(vx, vy);
          }
          startPosRef.current = null;
          cancelTapRef.current = !isTap;

          if (isTap && tapTargetRef.current && !focusedElRef.current) {
            openItemFromElement(tapTargetRef.current);
          }
          tapTargetRef.current = null;

          if (cancelTapRef.current) {
            window.setTimeout(() => {
              cancelTapRef.current = false;
            }, 120);
          }
          if (movedRef.current) lastDragEndAt.current = performance.now();
          movedRef.current = false;
        }
      },
    },
    { target: mainRef, eventOptions: { passive: false } },
  );

  useEffect(() => {
    const scrim = scrimRef.current;
    const root = rootRef.current;
    if (!scrim || !root) return;

    const close = () => {
      if (performance.now() - openStartedAtRef.current < 250) return;
      const el = focusedElRef.current;
      if (!el) return;
      const parent = el.parentElement;
      const overlay = viewerRef.current?.querySelector('.dome-gallery-enlarge');
      if (!parent || !(overlay instanceof HTMLElement)) return;

      const refDiv = parent.querySelector('.dome-gallery-tile--ref');
      const originalPos = originalTilePositionRef.current;
      if (!originalPos) {
        overlay.remove();
        refDiv?.remove();
        parent.style.setProperty('--rot-y-delta', `0deg`);
        parent.style.setProperty('--rot-x-delta', `0deg`);
        el.style.visibility = '';
        el.style.zIndex = '0';
        focusedElRef.current = null;
        root.removeAttribute('data-enlarging');
        openingRef.current = false;
        return;
      }

      const currentRect = overlay.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const overlayLeft = currentRect.left - rootRect.left;
      const overlayTop = currentRect.top - rootRect.top;
      const tileLeft = originalPos.left - rootRect.left;
      const tileTop = originalPos.top - rootRect.top;
      const sx =
        originalPos.width > 0 ? originalPos.width / currentRect.width : 1;
      const sy =
        originalPos.height > 0 ? originalPos.height / currentRect.height : 1;

      const animatingOverlay = document.createElement('div');
      animatingOverlay.className = 'dome-gallery-enlarge-closing';
      animatingOverlay.style.left = `${overlayLeft}px`;
      animatingOverlay.style.top = `${overlayTop}px`;
      animatingOverlay.style.width = `${currentRect.width}px`;
      animatingOverlay.style.height = `${currentRect.height}px`;
      animatingOverlay.style.borderRadius = openedImageBorderRadius;
      animatingOverlay.style.transition = `transform ${enlargeTransitionMs}ms ease-out, opacity ${enlargeTransitionMs}ms ease-out`;
      animatingOverlay.style.filter = grayscale ? 'grayscale(1)' : 'none';

      const originalImg = overlay.querySelector('img');
      if (originalImg) {
        const img = originalImg.cloneNode(true);
        animatingOverlay.appendChild(img);
      }

      overlay.remove();
      root.appendChild(animatingOverlay);
      void animatingOverlay.getBoundingClientRect();

      const reduce = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const tx = tileLeft - overlayLeft;
      const ty = tileTop - overlayTop;

      const cleanup = () => {
        animatingOverlay.remove();
        originalTilePositionRef.current = null;
        refDiv?.remove();
        parent.style.transition = 'none';
        el.style.transition = 'none';
        parent.style.setProperty('--rot-y-delta', `0deg`);
        parent.style.setProperty('--rot-x-delta', `0deg`);

        requestAnimationFrame(() => {
          el.style.visibility = '';
          el.style.opacity = '0';
          el.style.zIndex = '0';
          focusedElRef.current = null;
          root.removeAttribute('data-enlarging');

          requestAnimationFrame(() => {
            parent.style.transition = '';
            el.style.transition = 'opacity 300ms ease-out';
            requestAnimationFrame(() => {
              el.style.opacity = '1';
              window.setTimeout(() => {
                el.style.transition = '';
                el.style.opacity = '';
                openingRef.current = false;
              }, 300);
            });
          });
        });
      };

      if (reduce) {
        cleanup();
        return;
      }

      requestAnimationFrame(() => {
        animatingOverlay.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
        animatingOverlay.style.opacity = '0';
      });

      animatingOverlay.addEventListener('transitionend', cleanup, {
        once: true,
      });
    };

    const onScrimClick = () => close();
    scrim.addEventListener('click', onScrimClick);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !focusedElRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);

    return () => {
      scrim.removeEventListener('click', onScrimClick);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [enlargeTransitionMs, openedImageBorderRadius, grayscale]);

  const tryOpen = (target: HTMLElement) => {
    if (draggingRef.current) return;
    if (movedRef.current) return;
    if (performance.now() - lastDragEndAt.current < 80) return;
    if (openingRef.current) return;
    openItemFromElement(target);
  };

  const rootStyle: RootStyle = {
    '--segments-x': segments,
    '--segments-y': segments,
    '--overlay-blur-color': overlayBlurColor,
    '--tile-radius': imageBorderRadius,
    '--enlarge-radius': openedImageBorderRadius,
    '--image-filter': grayscale ? 'grayscale(1)' : 'none',
  };

  return (
    <div ref={rootRef} className="dome-gallery" style={rootStyle}>
      <ul className="sr-only">
        {captions.map((image) => (
          <li key={image.src}>{image.alt}</li>
        ))}
      </ul>
      <div
        ref={mainRef}
        className="dome-gallery-main"
        style={{ backgroundColor: overlayBlurColor }}
        aria-hidden="true"
      >
        <div className="dome-gallery-stage">
          <div ref={sphereRef} className="dome-gallery-sphere">
            {items.map((it) => {
              const itemStyle: ItemStyle = {
                '--offset-x': it.x,
                '--offset-y': it.y,
                '--item-size-x': it.sizeX,
                '--item-size-y': it.sizeY,
              };
              return (
                <div
                  key={`${it.x},${it.y}`}
                  className="dome-gallery-item"
                  data-src={it.src}
                  data-alt={it.alt}
                  data-offset-x={it.x}
                  data-offset-y={it.y}
                  data-size-x={it.sizeX}
                  data-size-y={it.sizeY}
                  style={itemStyle}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    className="dome-gallery-tile"
                    aria-label={it.alt}
                    onClick={(e) => tryOpen(e.currentTarget)}
                    onPointerUp={(e) => {
                      if (e.pointerType !== 'touch') return;
                      tryOpen(e.currentTarget);
                    }}
                    style={{
                      borderRadius: `var(--tile-radius, ${imageBorderRadius})`,
                      backgroundColor: overlayBlurColor,
                    }}
                  >
                    <img src={it.src} draggable={false} alt="" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dome-gallery-vignette" />
        <div className="dome-gallery-vignette-mask" />
        <div className="dome-gallery-edge dome-gallery-edge--top" />
        <div className="dome-gallery-edge dome-gallery-edge--bottom" />

        <div ref={viewerRef} className="dome-gallery-viewer">
          <div ref={scrimRef} className="dome-gallery-scrim" />
          <div
            ref={frameRef}
            className="dome-gallery-frame"
            style={{
              width: openedImageWidth,
              height: openedImageHeight,
              borderRadius: `var(--enlarge-radius, ${openedImageBorderRadius})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
