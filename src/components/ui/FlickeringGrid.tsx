// Source: https://inspira-ui.com/docs/en/components/backgrounds/flickering-grid  Adapted: 2026-09-04
// Vue original ported to React: same canvas recipe, our tokens and cn().
// Extra: major-cell lattice + pointer-follow glow.

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type FlickeringGridProps = {
  className?: string;
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  /** CSS color, `var(--token)`, or omit to use `--color-accent`. */
  color?: string;
  maxOpacity?: number;
  /** Brighten every Nth row/col as a lattice. 0 = off. */
  majorEvery?: number;
  /** Cells glow around the pointer. Off under reduced motion. */
  interactive?: boolean;
};

type GridParams = {
  cols: number;
  rows: number;
  squares: Float32Array;
  excite: Float32Array;
  dpr: number;
  fill: string;
};

type PointerState = {
  x: number;
  y: number;
  inside: boolean;
};

const VAR_TOKEN = /^var\(\s*(--[\w-]+)/;
const GLOW_RADIUS = 150;
const EXCITE_DECAY = 3.4;

function readToken(el: Element, value: string | undefined, fallback: string) {
  const styles = getComputedStyle(el);
  if (!value) return styles.getPropertyValue(fallback).trim();
  const token = VAR_TOKEN.exec(value)?.[1];
  if (token) return styles.getPropertyValue(token).trim() || value;
  return value;
}

/**
 * Canvas grid whose cells randomly change opacity. Optional lattice ticks
 * and a pointer-follow glow. Paints only while on screen; static under
 * reduced motion.
 */
export function FlickeringGrid({
  className,
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  color,
  maxOpacity = 0.3,
  majorEvery = 0,
  interactive = false,
}: FlickeringGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
      .matches;

    let params: GridParams | null = null;
    let frame: number | null = null;
    let inView = false;
    let lastTime = 0;
    const pointer: PointerState = { x: -1, y: -1, inside: false };

    const setup = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      setSize({ width, height });

      const cols = Math.floor(width / (squareSize + gridGap));
      const rows = Math.floor(height / (squareSize + gridGap));
      const count = Math.max(cols * rows, 0);
      const squares = new Float32Array(count);
      for (let i = 0; i < squares.length; i += 1) {
        squares[i] = Math.random() * maxOpacity;
      }
      params = {
        cols,
        rows,
        squares,
        excite: new Float32Array(count),
        dpr,
        fill: readToken(container, color, '--color-accent'),
      };
    };

    const draw = () => {
      if (!params) return;
      const { cols, rows, squares, excite, dpr, fill } = params;
      const cell = (squareSize + gridGap) * dpr;
      const half = (squareSize * dpr) / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = fill;

      const px = pointer.x * dpr;
      const py = pointer.y * dpr;
      const glowR = GLOW_RADIUS * dpr;

      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const idx = i * rows + j;
          let alpha = squares[idx] ?? 0;
          const lattice =
            majorEvery > 0 && (i % majorEvery === 0 || j % majorEvery === 0);
          if (lattice) alpha = Math.min(maxOpacity, alpha + maxOpacity * 0.35);

          const energy = excite[idx] ?? 0;
          if (energy > 0.01) alpha = Math.min(1, alpha + energy * 0.95);

          if (pointer.inside && !reduced) {
            const cx = i * cell + half;
            const cy = j * cell + half;
            const dist = Math.hypot(cx - px, cy - py);
            const falloff = 1 - dist / glowR;
            if (falloff > 0) {
              alpha = Math.min(1, alpha + falloff * falloff * 0.85);
            }
          }

          ctx.globalAlpha = alpha;
          ctx.fillRect(i * cell, j * cell, squareSize * dpr, squareSize * dpr);
        }
      }

      ctx.globalAlpha = 1;
    };

    const animate = (time: number) => {
      if (!inView || !params) return;

      const delta = lastTime ? (time - lastTime) / 1000 : 0;
      lastTime = time;

      const { cols, rows, squares, excite } = params;
      const cell = squareSize + gridGap;
      const decay = Math.exp(-EXCITE_DECAY * delta);

      for (let i = 0; i < squares.length; i += 1) {
        if (Math.random() < flickerChance * delta) {
          squares[i] = Math.random() * maxOpacity;
        }
        const current = excite[i] ?? 0;
        if (current > 0.002) excite[i] = current * decay;
        else if (current !== 0) excite[i] = 0;
      }

      if (interactive && !reduced && pointer.inside) {
        const col = Math.floor(pointer.x / cell);
        const row = Math.floor(pointer.y / cell);
        const reach = Math.ceil(GLOW_RADIUS / cell);
        for (let i = col - reach; i <= col + reach; i += 1) {
          if (i < 0 || i >= cols) continue;
          for (let j = row - reach; j <= row + reach; j += 1) {
            if (j < 0 || j >= rows) continue;
            const dx = (i + 0.5) * cell - pointer.x;
            const dy = (j + 0.5) * cell - pointer.y;
            const falloff = 1 - Math.hypot(dx, dy) / GLOW_RADIUS;
            if (falloff <= 0) continue;
            const idx = i * rows + j;
            const next = falloff * falloff;
            if (next > (excite[idx] ?? 0)) excite[idx] = next;
          }
        }
      }

      draw();
      frame = requestAnimationFrame(animate);
    };

    setup();
    draw();

    const resizeObserver = new ResizeObserver(() => {
      setup();
      draw();
    });
    resizeObserver.observe(container);

    const host = container.closest('[data-flicker-host]');
    const onPointerMove = (event: Event) => {
      const pointerEvent = event as PointerEvent;
      const rect = canvas.getBoundingClientRect();
      pointer.x = pointerEvent.clientX - rect.left;
      pointer.y = pointerEvent.clientY - rect.top;
      pointer.inside = true;
    };
    const onPointerLeave = () => {
      pointer.inside = false;
    };

    if (interactive && !reduced && host) {
      host.addEventListener('pointermove', onPointerMove);
      host.addEventListener('pointerleave', onPointerLeave);
    }

    let intersectionObserver: IntersectionObserver | null = null;
    if (!reduced) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          inView = entries[0]?.isIntersecting ?? false;
          if (!inView) {
            if (frame) cancelAnimationFrame(frame);
            frame = null;
            lastTime = 0;
            return;
          }
          if (frame === null) frame = requestAnimationFrame(animate);
        },
        { threshold: 0 },
      );
      intersectionObserver.observe(canvas);
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      host?.removeEventListener('pointermove', onPointerMove);
      host?.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [
    squareSize,
    gridGap,
    flickerChance,
    color,
    maxOpacity,
    majorEvery,
    interactive,
  ]);

  return (
    <div ref={containerRef} className={cn('h-full w-full', className)}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none block"
        style={{ width: size.width, height: size.height }}
      />
    </div>
  );
}
