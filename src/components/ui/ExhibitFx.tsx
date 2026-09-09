import { useEffect, useRef } from 'react';

import internalUrl from '@/assets/images/commodore-internal.png?url';
import {
  bakeXrayPlate,
  hitRocketSilhouette,
  makeGrainPattern,
  paintXrayHole,
  parseHexRgb,
  syncCanvasSize,
} from '@/components/ui/xray-runtime';
import {
  EXHIBIT_XRAY_HIT_PAD,
  EXHIBIT_XRAY_HOLE,
  EXHIBIT_STANDS,
  exhibitFloat,
  exhibitRocketLength,
  exhibitRocketOffset,
  exhibitRocketTilt,
  exhibitXrayBox,
  ROCKET_SLENDERNESS,
} from '@/lib/rocket';

type ExhibitFxProps = {
  // Mirrors the stage: nose-up rocket, plate and hit box turn with it.
  portrait: boolean;
};

/**
 * Hover X-ray: a pixelated noisy hole tracks the pointer and stamps a
 * soft cyan blueprint of the internals over the exhibit rocket.
 */
export function ExhibitFx({ portrait }: ExhibitFxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Orientation is a dependency, not a ref: a flip rebakes the plate, which
  // is rare enough that the simpler effect wins.
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
    let want = 0;
    let open = 0;
    let lastX = 0;
    let lastY = 0;
    let hasLast = false;
    let dead = false;
    let raf = 0;
    let lastTick = 0;

    const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);

    const imageBox = (width: number, height: number) => {
      if (!plate || plate.width === 0) return null;
      return exhibitXrayBox(
        width,
        height,
        plate.height / plate.width,
        portrait,
      );
    };

    const hullBox = (width: number, height: number) => {
      const length = exhibitRocketLength(width, height, portrait);
      const girth = length * ROCKET_SLENDERNESS;
      const hullW = portrait ? girth : length;
      const hullH = portrait ? length : girth;
      const offset = exhibitRocketOffset(portrait);
      return {
        x: width * 0.5 - hullW * 0.5 + offset.x * width,
        y: height * 0.5 - hullH * 0.5 - offset.y * height,
        w: hullW,
        h: hullH,
      };
    };

    const overHull = (
      px: number,
      py: number,
      hull: ReturnType<typeof hullBox>,
    ) =>
      px >= hull.x &&
      px <= hull.x + hull.w &&
      py >= hull.y &&
      py <= hull.y + hull.h;

    const stageCanvas = () => {
      const node =
        root.parentElement?.querySelector('.rocket-exhibit-stage canvas') ??
        null;
      return node instanceof HTMLCanvasElement ? node : null;
    };

    const overRocket = (px: number, py: number, width: number, height: number) => {
      const hull = hullBox(width, height);
      if (!overHull(px, py, hull)) return false;
      const rocket = stageCanvas();
      if (!rocket) return false;
      return hitRocketSilhouette(
        rocket,
        px,
        py,
        width,
        height,
        EXHIBIT_XRAY_HIT_PAD,
      );
    };

    const paint = () => {
      const box = root.getBoundingClientRect();
      const width = box.width;
      const height = box.height;
      if (width === 0 || height === 0 || !plate) return;

      const dpr = dprOf();
      syncCanvasSize(canvas, width, height, dpr);

      const layout = imageBox(width, height);
      if (!layout) return;
      const full =
        Math.min(width, height) *
        (reduce ? EXHIBIT_XRAY_HOLE * 2.1 : EXHIBIT_XRAY_HOLE);
      // Smoothstep so the hole blooms from a spark instead of popping.
      const bloom = open * open * (3 - 2 * open);

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
        radius: full * (0.18 + 0.82 * bloom),
        seed: reduce ? 0 : seed,
        alpha: Math.min(1, open * 1.35),
        imgX: layout.imgX,
        imgY: layout.imgY,
        imgW: layout.imgW,
        imgH: layout.imgH,
        rocketCx: layout.rocketCx,
        rocketCy: layout.rocketCy,
        pitch: exhibitFloat.pitch + exhibitRocketTilt(portrait),
        rocket: stageCanvas(),
        tint,
      });
    };

    const tick = (now: number) => {
      raf = 0;
      if (dead) return;
      if (lastTick === 0) lastTick = now;
      const dt = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;
      const tau = want > open ? 0.18 : 0.12;
      open += (want - open) * (1 - Math.exp(-dt / tau));
      if (Math.abs(want - open) < 0.003) open = want;
      paint();
      const followFloat = !EXHIBIT_STANDS && !reduce && open > 0;
      if (open !== want || followFloat) raf = requestAnimationFrame(tick);
      else lastTick = 0;
    };

    const setWant = (next: number) => {
      want = next;
      if (reduce) {
        open = want;
        paint();
        return;
      }
      if (!raf) raf = requestAnimationFrame(tick);
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
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const hit = overRocket(x, y, box.width, box.height);
      if (hit) {
        pointerX = x;
        pointerY = y;
        if (!reduce && hasLast) {
          seed += Math.hypot(pointerX - lastX, pointerY - lastY) * 0.014;
        }
        lastX = pointerX;
        lastY = pointerY;
        hasLast = true;
        if (want !== 1) setWant(1);
        else paint();
      } else {
        hasLast = false;
        if (want !== 0) setWant(0);
      }
    };

    const leave = () => {
      hasLast = false;
      setWant(0);
    };

    const onResize = () => paint();

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerleave', leave);
    window.addEventListener('resize', onResize);
    return () => {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', onResize);
    };
  }, [portrait]);

  return (
    <div ref={rootRef} className="rocket-exhibit-xray" aria-hidden="true">
      <canvas ref={canvasRef} className="rocket-exhibit-xray-canvas" />
    </div>
  );
}
