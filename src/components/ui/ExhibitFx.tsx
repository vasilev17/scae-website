import { useEffect, useRef } from 'react';

import internalUrl from '@/assets/images/commodore-internal.png?url';
import {
  bakeXrayPlate,
  makeGrainPattern,
  paintXrayHole,
  parseHexRgb,
  syncCanvasSize,
} from '@/components/ui/xray-runtime';
import { EXHIBIT_XRAY_FILL, EXHIBIT_XRAY_X, EXHIBIT_XRAY_Y } from '@/lib/rocket';

/**
 * Hover X-ray: a pixelated noisy hole tracks the pointer and stamps a
 * soft cyan blueprint of the internals over the exhibit rocket.
 */
export function ExhibitFx() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const accent =
      getComputedStyle(root).getPropertyValue('--color-accent').trim() ||
      '#60a5fa';
    const tint = parseHexRgb(accent);
    const fill = `color-mix(in srgb, ${accent} 28%, #000)`;
    const grain = makeGrainPattern(ctx, tint);

    let plate: HTMLCanvasElement | null = null;
    let pointerX = 0;
    let pointerY = 0;
    let seed = 0;
    let on = false;
    let lastX = 0;
    let lastY = 0;
    let hasLast = false;
    let dead = false;

    const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);

    const paint = () => {
      const box = root.getBoundingClientRect();
      const width = box.width;
      const height = box.height;
      if (width === 0 || height === 0 || !plate) return;

      const dpr = dprOf();
      syncCanvasSize(canvas, width, height, dpr);

      const imgW = width * EXHIBIT_XRAY_FILL;
      const imgH = imgW * (plate.height / plate.width);
      const radius = on ? Math.min(width, height) * (reduce ? 0.42 : 0.2) : 0;

      paintXrayHole({
        ctx,
        dpr,
        width,
        height,
        plate,
        grain,
        fill,
        pointerX,
        pointerY,
        radius,
        seed: reduce ? 0 : seed,
        imgX: width * 0.5 - imgW * 0.5 + EXHIBIT_XRAY_X * width,
        imgY: height * 0.5 - imgH * 0.5 - EXHIBIT_XRAY_Y * height,
        imgW,
        imgH,
      });
    };

    const image = new Image();
    image.src = internalUrl;
    void image.decode().then(
      () => {
        if (dead) return;
        plate = bakeXrayPlate(image, tint);
        paint();
      },
      () => undefined,
    );

    const move = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      pointerX = event.clientX - box.left;
      pointerY = event.clientY - box.top;
      on = true;
      if (!reduce && hasLast) {
        seed += Math.hypot(pointerX - lastX, pointerY - lastY) * 0.014;
      }
      lastX = pointerX;
      lastY = pointerY;
      hasLast = true;
      paint();
    };

    const leave = () => {
      on = false;
      hasLast = false;
      paint();
    };

    const onResize = () => paint();

    root.addEventListener('pointermove', move);
    root.addEventListener('pointerleave', leave);
    window.addEventListener('resize', onResize);
    return () => {
      dead = true;
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div ref={rootRef} className="rocket-exhibit-xray" aria-hidden="true">
      <canvas ref={canvasRef} className="rocket-exhibit-xray-canvas" />
    </div>
  );
}
