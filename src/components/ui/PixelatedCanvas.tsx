// Source: https://ui.aceternity.com/components/pixelated-canvas  Adapted: 2026-09-08
// Coming-soon Home hover-orb settings. Pointer distorts sampled dots (repel).

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type DistortionMode = 'repel' | 'attract' | 'swirl';
type ObjectFit = 'cover' | 'contain' | 'fill' | 'none';
type DotShape = 'circle' | 'square';

type PixelSample = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  drop: boolean;
  seed: number;
};

type CanvasDims = {
  width: number;
  height: number;
  dot: number;
};

// The only state the two effects share. Sampling the image and listening to
// the pointer are separate concerns on separate lifetimes: turning the
// interaction off must not cost a re-decode and a re-sample of the mark, which
// would land on exactly the devices that asked for the cheaper mode.
type PointerRuntime = {
  dims: CanvasDims | null;
  target: { x: number; y: number };
  cursor: { x: number; y: number };
  inside: boolean;
  activity: number;
  activityTarget: number;
  startLoop: (() => void) | null;
};

type PixelatedCanvasProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  cellSize?: number;
  dotScale?: number;
  shape?: DotShape;
  backgroundColor?: string;
  grayscale?: boolean;
  className?: string;
  responsive?: boolean;
  dropoutStrength?: number;
  interactive?: boolean;
  distortionStrength?: number;
  distortionRadius?: number;
  distortionMode?: DistortionMode;
  followSpeed?: number;
  sampleAverage?: boolean;
  tintColor?: string;
  tintStrength?: number;
  maxFps?: number;
  objectFit?: ObjectFit;
  jitterStrength?: number;
  jitterSpeed?: number;
  fadeOnLeave?: boolean;
  fadeSpeed?: number;
  // Shrinks the mark inside the buffer without shrinking the buffer, so the
  // canvas can cover its whole box -- and stay hoverable out to the edges --
  // while the artwork still sits inset from whatever frames it.
  imageScale?: number;
  // Nudges the artwork, in fractions of its drawn size, so it survives a
  // change of imageScale. Artwork is rarely centred in its own file, and no
  // automatic measure of it agrees with the eye: a bounding box follows
  // whatever spikes furthest out, a centroid follows whatever is brightest,
  // and the eye follows the shape it reads as the subject. Measure the file,
  // then say the number here.
  imageOffsetX?: number;
  imageOffsetY?: number;
};

export function PixelatedCanvas({
  src,
  alt,
  width = 300,
  height = 300,
  cellSize = 3,
  dotScale = 0.9,
  shape = 'square',
  backgroundColor,
  grayscale = false,
  className,
  responsive = false,
  dropoutStrength = 0.4,
  interactive = true,
  distortionStrength = 3,
  distortionRadius = 80,
  distortionMode = 'swirl',
  followSpeed = 0.2,
  sampleAverage = true,
  tintColor,
  tintStrength = 0.2,
  maxFps = 60,
  objectFit = 'cover',
  jitterStrength = 4,
  jitterSpeed = 4,
  fadeOnLeave = true,
  fadeSpeed = 0.1,
  imageScale = 1,
  imageOffsetX = 0,
  imageOffsetY = 0,
}: PixelatedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtime = useRef<PointerRuntime>({
    dims: null,
    target: { x: -9999, y: -9999 },
    cursor: { x: -9999, y: -9999 },
    inside: false,
    activity: 0,
    activityTarget: 0,
    startLoop: null,
  });
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Samples the image into dots and owns the frame loop. Deliberately blind to
  // `interactive`: binding the pointer is the other effect's job.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rt = runtime.current;
    let cancelled = false;
    let raf = 0;
    let lastFrame = 0;
    let samples: PixelSample[] = [];

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resolveTint = () => {
      const raw =
        tintColor ??
        getComputedStyle(canvas).getPropertyValue('--color-accent').trim();
      return parseHex(raw);
    };

    const layoutSize = () => {
      const parent = canvas.parentElement;
      let displayWidth = width;
      let displayHeight = height;
      if (responsive && parent) {
        // clientWidth ignores the gallery scale-in, so the buffer is not 0×0
        // while GSAP still has the mark at scale(0). It does count the
        // parent's padding though, which the canvas's own `width: 100%` does
        // not -- measure the content box or the buffer overhangs the padding,
        // taking the mark off centre and pushing it under the clip.
        const box = getComputedStyle(parent);
        const boxWidth =
          parent.clientWidth -
          Number.parseFloat(box.paddingLeft) -
          Number.parseFloat(box.paddingRight);
        const boxHeight =
          parent.clientHeight -
          Number.parseFloat(box.paddingTop) -
          Number.parseFloat(box.paddingBottom);
        if (boxWidth > 0) displayWidth = boxWidth;
        if (boxHeight > 0) displayHeight = boxHeight;
      }
      return { displayWidth, displayHeight };
    };

    const compute = () => {
      if (cancelled) return false;
      const { displayWidth, displayHeight } = layoutSize();
      if (displayWidth < 1 || displayHeight < 1) return false;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(displayWidth * dpr));
      canvas.height = Math.max(1, Math.floor(displayHeight * dpr));
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const offscreen = document.createElement('canvas');
      offscreen.width = Math.max(1, Math.floor(displayWidth));
      offscreen.height = Math.max(1, Math.floor(displayHeight));
      const off = offscreen.getContext('2d');
      if (!off) return false;

      const fitted = fitImage(
        img.naturalWidth || displayWidth,
        img.naturalHeight || displayHeight,
        displayWidth,
        displayHeight,
        objectFit,
        imageScale,
        imageOffsetX,
        imageOffsetY,
      );
      off.drawImage(img, fitted.dx, fitted.dy, fitted.dw, fitted.dh);

      let imageData: ImageData;
      try {
        imageData = off.getImageData(0, 0, offscreen.width, offscreen.height);
      } catch {
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
        return false;
      }

      const data = imageData.data;
      const stride = offscreen.width * 4;
      // Not floored: at cellSize 3 a 0.9 scale rounds down to 2, which thins
      // the mark by a third rather than the tenth the scale asks for.
      const effectiveDot = Math.max(0.5, cellSize * dotScale);
      rt.dims = {
        width: displayWidth,
        height: displayHeight,
        dot: effectiveDot,
      };

      const tintRgb = tintStrength > 0 ? resolveTint() : null;
      const next: PixelSample[] = [];

      for (let y = 0; y < offscreen.height; y += cellSize) {
        const cy = Math.min(offscreen.height - 1, y + Math.floor(cellSize / 2));
        for (let x = 0; x < offscreen.width; x += cellSize) {
          const cx = Math.min(
            offscreen.width - 1,
            x + Math.floor(cellSize / 2),
          );
          const sample = readCell(data, stride, offscreen, cx, cy, sampleAverage);
          const { a } = sample;
          let { r, g, b } = sample;

          if (grayscale) {
            const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
            r = luma;
            g = luma;
            b = luma;
          } else if (tintRgb) {
            const k = clamp01(tintStrength);
            r = Math.round(r * (1 - k) + tintRgb[0] * k);
            g = Math.round(g * (1 - k) + tintRgb[1] * k);
            b = Math.round(b * (1 - k) + tintRgb[2] * k);
          }

          const gradientNorm = edgeNorm(data, stride, offscreen, cx, cy);
          const dropoutProb = clamp01((1 - gradientNorm) * dropoutStrength);
          const seed = hash2D(cx, cy);
          next.push({
            x,
            y,
            r,
            g,
            b,
            a,
            drop: seed < dropoutProb,
            seed,
          });
        }
      }

      samples = next;
      return true;
    };

    const paintFrame = (distort: boolean) => {
      const dims = rt.dims;
      if (!dims) return;
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, dims.width, dims.height);
      } else {
        ctx.clearRect(0, 0, dims.width, dims.height);
      }

      const mx = rt.cursor.x;
      const my = rt.cursor.y;
      const sigma = Math.max(1, distortionRadius * 0.5);
      const t = performance.now() * 0.001 * jitterSpeed;
      const influenceCap = distort ? clamp01(rt.activity) : 0;

      for (const cell of samples) {
        if (cell.drop || cell.a <= 0) continue;
        let drawX = cell.x + cellSize / 2;
        let drawY = cell.y + cellSize / 2;

        if (influenceCap > 0) {
          const dx = drawX - mx;
          const dy = drawY - my;
          const dist2 = dx * dx + dy * dy;
          const influence = Math.exp(-dist2 / (2 * sigma * sigma)) * influenceCap;
          if (influence > 0.0005) {
            const dist = Math.sqrt(dist2) + 0.0001;
            if (distortionMode === 'repel') {
              drawX += (dx / dist) * distortionStrength * influence;
              drawY += (dy / dist) * distortionStrength * influence;
            } else if (distortionMode === 'attract') {
              drawX -= (dx / dist) * distortionStrength * influence;
              drawY -= (dy / dist) * distortionStrength * influence;
            } else {
              const angle = distortionStrength * 0.05 * influence;
              const rx = Math.cos(angle) * dx - Math.sin(angle) * dy;
              const ry = Math.sin(angle) * dx + Math.cos(angle) * dy;
              drawX = mx + rx;
              drawY = my + ry;
            }
            if (jitterStrength > 0) {
              const k = cell.seed * 43758.5453;
              drawX += Math.sin(t + k) * jitterStrength * influence;
              drawY += Math.cos(t + k * 1.13) * jitterStrength * influence;
            }
          }
        }

        ctx.globalAlpha = cell.a;
        ctx.fillStyle = `rgb(${cell.r},${cell.g},${cell.b})`;
        if (shape === 'circle') {
          ctx.beginPath();
          ctx.arc(drawX, drawY, dims.dot / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(
            drawX - dims.dot / 2,
            drawY - dims.dot / 2,
            dims.dot,
            dims.dot,
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    const stopLoop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - lastFrame < 1000 / Math.max(1, maxFps)) return;
      lastFrame = now;

      rt.cursor.x += (rt.target.x - rt.cursor.x) * followSpeed;
      rt.cursor.y += (rt.target.y - rt.cursor.y) * followSpeed;
      if (fadeOnLeave) {
        rt.activity += (rt.activityTarget - rt.activity) * fadeSpeed;
      } else {
        rt.activity = rt.inside ? 1 : 0;
      }

      paintFrame(true);

      if (!rt.inside && rt.activity < 0.001) {
        rt.activity = 0;
        paintFrame(false);
        stopLoop();
      }
    };

    const startLoop = () => {
      if (raf || cancelled) return;
      lastFrame = 0;
      raf = requestAnimationFrame(tick);
    };

    // The pointer effect reaches the loop through here, so it always calls the
    // live one rather than whichever closure it happened to capture.
    rt.startLoop = startLoop;

    const syncMode = () => {
      stopLoop();
      rt.activity = 0;
      rt.activityTarget = 0;
      rt.inside = false;
      if (!compute()) return false;
      paintFrame(false);
      return true;
    };

    let started = false;
    const start = () => {
      if (cancelled || started) return;
      if (!img.naturalWidth) return;
      // A parent with no size yet leaves this false, so the resize observer
      // gets another go rather than the mark staying blank and deaf to the
      // pointer for the life of the page.
      started = syncMode();
    };

    img.addEventListener('load', start);
    img.src = src;
    if (img.complete) start();

    const observer =
      responsive && canvas.parentElement
        ? new ResizeObserver(() => {
            if (!img.naturalWidth || cancelled) return;
            if (!started) {
              start();
              return;
            }
            const running = raf !== 0;
            compute();
            if (!running) paintFrame(false);
          })
        : null;
    if (observer && canvas.parentElement) observer.observe(canvas.parentElement);

    return () => {
      cancelled = true;
      stopLoop();
      rt.startLoop = null;
      rt.dims = null;
      observer?.disconnect();
      img.removeEventListener('load', start);
    };
  }, [
    src,
    width,
    height,
    cellSize,
    dotScale,
    shape,
    backgroundColor,
    grayscale,
    responsive,
    dropoutStrength,
    distortionStrength,
    distortionRadius,
    distortionMode,
    followSpeed,
    sampleAverage,
    tintColor,
    tintStrength,
    maxFps,
    objectFit,
    jitterStrength,
    jitterSpeed,
    fadeOnLeave,
    fadeSpeed,
    imageScale,
    imageOffsetX,
    imageOffsetY,
  ]);

  // Listeners only. Turning interaction off unbinds and lets the loop settle
  // to a static mark; it never touches the sampled buffer, so no re-decode.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactive || reduced) return;

    const rt = runtime.current;

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const dims = rt.dims;
      if (!dims || rect.width < 1 || rect.height < 1) return;
      // The box on screen is not always the buffer's own size -- the gallery
      // scales the mark in -- so the cursor has to be mapped through it
      // instead of being read as buffer pixels.
      rt.target.x = (clientX - rect.left) * (dims.width / rect.width);
      rt.target.y = (clientY - rect.top) * (dims.height / rect.height);
      rt.inside = true;
      rt.activityTarget = 1;
      rt.startLoop?.();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || event.isPrimary) {
        updatePointer(event.clientX, event.clientY);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      updatePointer(event.clientX, event.clientY);
    };

    const onPointerUp = (event: PointerEvent) => {
      canvas.releasePointerCapture(event.pointerId);
      if (event.pointerType !== 'mouse') {
        rt.inside = false;
        if (fadeOnLeave) rt.activityTarget = 0;
      }
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      rt.inside = false;
      if (fadeOnLeave) {
        rt.activityTarget = 0;
      } else {
        rt.target.x = -9999;
        rt.target.y = -9999;
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      // Hand the mark back to the loop to wind down and repaint clean, rather
      // than freezing it mid-distortion.
      rt.inside = false;
      rt.activityTarget = 0;
      rt.startLoop?.();
    };
  }, [interactive, reduced, fadeOnLeave]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(className)}
      role="img"
      aria-label={alt}
    />
  );
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function hash2D(ix: number, iy: number) {
  const s = Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453123;
  return s - Math.floor(s);
}

function parseHex(color: string): [number, number, number] | null {
  if (!color.startsWith('#')) return null;
  const hex = color.slice(1);
  if (hex.length === 3) {
    const r = hex[0];
    const g = hex[1];
    const b = hex[2];
    if (!r || !g || !b) return null;
    return [
      Number.parseInt(r + r, 16),
      Number.parseInt(g + g, 16),
      Number.parseInt(b + b, 16),
    ];
  }
  if (hex.length !== 6) return null;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function fitImage(
  iw: number,
  ih: number,
  displayWidth: number,
  displayHeight: number,
  objectFit: ObjectFit,
  imageScale: number,
  imageOffsetX: number,
  imageOffsetY: number,
) {
  const centred = (dw: number, dh: number) => ({
    dw,
    dh,
    dx: Math.round((displayWidth - dw) / 2 + dw * imageOffsetX),
    dy: Math.round((displayHeight - dh) / 2 + dh * imageOffsetY),
  });

  if (objectFit === 'fill') {
    return centred(displayWidth * imageScale, displayHeight * imageScale);
  }
  if (objectFit === 'none') {
    return centred(iw * imageScale, ih * imageScale);
  }
  const scale =
    (objectFit === 'cover'
      ? Math.max(displayWidth / iw, displayHeight / ih)
      : Math.min(displayWidth / iw, displayHeight / ih)) * imageScale;
  return centred(Math.ceil(iw * scale), Math.ceil(ih * scale));
}


function readCell(
  data: Uint8ClampedArray,
  stride: number,
  size: { width: number; height: number },
  cx: number,
  cy: number,
  sampleAverage: boolean,
) {
  if (!sampleAverage) {
    const idx = cy * stride + cx * 4;
    return {
      r: data[idx] ?? 0,
      g: data[idx + 1] ?? 0,
      b: data[idx + 2] ?? 0,
      a: (data[idx + 3] ?? 0) / 255,
    };
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let count = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const sx = Math.max(0, Math.min(size.width - 1, cx + ox));
      const sy = Math.max(0, Math.min(size.height - 1, cy + oy));
      const sIdx = sy * stride + sx * 4;
      r += data[sIdx] ?? 0;
      g += data[sIdx + 1] ?? 0;
      b += data[sIdx + 2] ?? 0;
      a += (data[sIdx + 3] ?? 0) / 255;
      count += 1;
    }
  }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
    a: a / count,
  };
}

function lumaAt(
  data: Uint8ClampedArray,
  stride: number,
  width: number,
  height: number,
  px: number,
  py: number,
) {
  const ix = Math.max(0, Math.min(width - 1, px));
  const iy = Math.max(0, Math.min(height - 1, py));
  const i = iy * stride + ix * 4;
  return (
    0.2126 * (data[i] ?? 0) +
    0.7152 * (data[i + 1] ?? 0) +
    0.0722 * (data[i + 2] ?? 0)
  );
}

function edgeNorm(
  data: Uint8ClampedArray,
  stride: number,
  size: { width: number; height: number },
  cx: number,
  cy: number,
) {
  const lc = lumaAt(data, stride, size.width, size.height, cx, cy);
  const lx1 = lumaAt(data, stride, size.width, size.height, cx - 1, cy);
  const lx2 = lumaAt(data, stride, size.width, size.height, cx + 1, cy);
  const ly1 = lumaAt(data, stride, size.width, size.height, cx, cy - 1);
  const ly2 = lumaAt(data, stride, size.width, size.height, cx, cy + 1);
  const grad =
    Math.abs(lx2 - lx1) +
    Math.abs(ly2 - ly1) +
    Math.abs(lc - (lx1 + lx2 + ly1 + ly2) / 4);
  return clamp01(grad / 255);
}
