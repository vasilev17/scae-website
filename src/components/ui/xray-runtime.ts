/**
 * Bake a cyan blueprint plate from the internals PNG, and stamp a
 * pixelated noisy hole that follows the pointer.
 */

export const XRAY_CELL = 12;

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm2(x: number, y: number): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i += 1) {
    value += amp * noise2(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return value;
}

function lumAt(lum: Float32Array, width: number, x: number, y: number): number {
  return lum[y * width + x] ?? 0;
}

export type Rgb = { r: number; g: number; b: number };

const FALLBACK_TINT: Rgb = { r: 96, g: 165, b: 250 };

export function parseHexRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const raw = match?.[1];
  if (!raw) return FALLBACK_TINT;
  const n = Number.parseInt(raw, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Soft cyan blueprint plate. Empty PNG stays transparent so the rocket
 * still reads through the hole.
 */
export function bakeXrayPlate(
  image: HTMLImageElement,
  tint: Rgb = FALLBACK_TINT,
): HTMLCanvasElement {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const src = document.createElement('canvas');
  src.width = width;
  src.height = height;
  const srcCtx = src.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) return src;

  srcCtx.drawImage(image, 0, 0);
  const pixels = srcCtx.getImageData(0, 0, width, height).data;
  const lum = new Float32Array(width * height);

  for (let i = 0; i < lum.length; i += 1) {
    const offset = i * 4;
    const r = pixels[offset] ?? 0;
    const g = pixels[offset + 1] ?? 0;
    const b = pixels[offset + 2] ?? 0;
    const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    lum[i] = Math.min(1, Math.max(0, (y - 0.05) * 1.2));
  }

  const out = srcCtx.createImageData(width, height);
  const dest = out.data;
  const lastX = width - 1;
  const lastY = height - 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const L = lum[i] ?? 0;
      let gx = 0;
      let gy = 0;
      if (x > 0 && x < lastX && y > 0 && y < lastY) {
        const nw = lumAt(lum, width, x - 1, y - 1);
        const n = lumAt(lum, width, x, y - 1);
        const ne = lumAt(lum, width, x + 1, y - 1);
        const w = lumAt(lum, width, x - 1, y);
        const e = lumAt(lum, width, x + 1, y);
        const sw = lumAt(lum, width, x - 1, y + 1);
        const s = lumAt(lum, width, x, y + 1);
        const se = lumAt(lum, width, x + 1, y + 1);
        gx = -nw + ne - 2 * w + 2 * e - sw + se;
        gy = -nw - 2 * n - ne + sw + 2 * s + se;
      }
      const edge = Math.min(1, Math.hypot(gx, gy) * 1.35);
      const grain = (hash2(x * 0.7, y * 1.3) - 0.5) * 0.08;
      const fill = L > 0.03 ? L * 0.42 + grain : 0;
      const v = Math.min(1, fill * 0.55 + edge * 0.7);
      const alpha = v < 0.04 ? 0 : Math.min(0.78, 0.22 + v * 0.55);
      const offset = i * 4;
      dest[offset] = Math.round(tint.r * v);
      dest[offset + 1] = Math.round(tint.g * v);
      dest[offset + 2] = Math.round(tint.b * v);
      dest[offset + 3] = Math.round(alpha * 255);
    }
  }

  srcCtx.putImageData(out, 0, 0);

  const plate = document.createElement('canvas');
  plate.width = width;
  plate.height = height;
  const plateCtx = plate.getContext('2d');
  if (!plateCtx) return src;

  plateCtx.filter = 'blur(0.7px)';
  plateCtx.globalAlpha = 0.4;
  plateCtx.drawImage(src, 0, 0);
  plateCtx.filter = 'none';
  plateCtx.globalAlpha = 1;
  plateCtx.drawImage(src, 0, 0);
  return plate;
}

export function makeGrainPattern(
  ctx: CanvasRenderingContext2D,
  tint: Rgb = FALLBACK_TINT,
): CanvasPattern | null {
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) return null;
  const data = tileCtx.createImageData(128, 128);
  const px = data.data;
  for (let i = 0; i < 128 * 128; i += 1) {
    const n = hash2(i, i * 0.37);
    const a = 8 + hash2(i * 0.19, i) * 14;
    const offset = i * 4;
    px[offset] = Math.round(tint.r * n);
    px[offset + 1] = Math.round(tint.g * n);
    px[offset + 2] = Math.round(tint.b * n);
    px[offset + 3] = a;
  }
  tileCtx.putImageData(data, 0, 0);
  return ctx.createPattern(tile, 'repeat');
}

export function drawPixelBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
): void {
  const pad = radius * 1.5;
  const x0 = Math.floor((cx - pad) / XRAY_CELL) * XRAY_CELL;
  const y0 = Math.floor((cy - pad) / XRAY_CELL) * XRAY_CELL;
  const x1 = cx + pad;
  const y1 = cy + pad;

  for (let y = y0; y <= y1; y += XRAY_CELL) {
    for (let x = x0; x <= x1; x += XRAY_CELL) {
      const px = x + XRAY_CELL / 2;
      const py = y + XRAY_CELL / 2;
      const n = fbm2(px * 0.028 + seed * 0.65, py * 0.028 - seed * 0.41);
      const limit = radius * (0.58 + 0.52 * n);
      if (Math.hypot(px - cx, py - cy) < limit) {
        ctx.fillRect(x, y, XRAY_CELL, XRAY_CELL);
      }
    }
  }
}

export type XrayPaint = {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  width: number;
  height: number;
  plate: HTMLCanvasElement;
  grain: CanvasPattern | null;
  fill: string;
  pointerX: number;
  pointerY: number;
  radius: number;
  seed: number;
  alpha: number;
  imgX: number;
  imgY: number;
  imgW: number;
  imgH: number;
  rocketCx?: number;
  rocketCy?: number;
  pitch?: number;
  rocket: HTMLCanvasElement | null;
  tint: Rgb;
};

type HullScratch = {
  src: HTMLCanvasElement;
  srcCtx: CanvasRenderingContext2D;
  edge: HTMLCanvasElement;
  edgeCtx: CanvasRenderingContext2D;
};

let hullScratch: HullScratch | null = null;

function getHullScratch(): HullScratch | null {
  if (hullScratch) return hullScratch;
  const src = document.createElement('canvas');
  const srcCtx = src.getContext('2d', { willReadFrequently: true });
  const edge = document.createElement('canvas');
  const edgeCtx = edge.getContext('2d');
  if (!srcCtx || !edgeCtx) return null;
  hullScratch = { src, srcCtx, edge, edgeCtx };
  return hullScratch;
}

/**
 * Sobel the exhibit WebGL canvas inside the hole: silhouette from alpha,
 * panel lines from luminance. Stamped source-atop so it stays in the blob.
 */
function stampHullEdges(ctx: CanvasRenderingContext2D, frame: XrayPaint): void {
  const rocket = frame.rocket;
  if (!rocket || rocket.width === 0 || rocket.height === 0) return;
  const scratch = getHullScratch();
  if (!scratch) return;

  const pad = frame.radius * 1.5;
  const x0 = Math.max(0, Math.floor(frame.pointerX - pad));
  const y0 = Math.max(0, Math.floor(frame.pointerY - pad));
  const x1 = Math.min(frame.width, Math.ceil(frame.pointerX + pad));
  const y1 = Math.min(frame.height, Math.ceil(frame.pointerY + pad));
  const cssW = x1 - x0;
  const cssH = y1 - y0;
  if (cssW < 2 || cssH < 2) return;

  const sw = Math.max(2, cssW);
  const sh = Math.max(2, cssH);
  if (scratch.src.width !== sw) scratch.src.width = sw;
  if (scratch.src.height !== sh) scratch.src.height = sh;
  if (scratch.edge.width !== sw) scratch.edge.width = sw;
  if (scratch.edge.height !== sh) scratch.edge.height = sh;

  const sx = (x0 / frame.width) * rocket.width;
  const sy = (y0 / frame.height) * rocket.height;
  const sWidth = (cssW / frame.width) * rocket.width;
  const sHeight = (cssH / frame.height) * rocket.height;
  scratch.srcCtx.clearRect(0, 0, sw, sh);
  scratch.srcCtx.drawImage(rocket, sx, sy, sWidth, sHeight, 0, 0, sw, sh);

  const pixels = scratch.srcCtx.getImageData(0, 0, sw, sh).data;
  const lum = new Float32Array(sw * sh);
  const alpha = new Float32Array(sw * sh);
  for (let i = 0; i < lum.length; i += 1) {
    const offset = i * 4;
    const r = pixels[offset] ?? 0;
    const g = pixels[offset + 1] ?? 0;
    const b = pixels[offset + 2] ?? 0;
    const a = pixels[offset + 3] ?? 0;
    lum[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    alpha[i] = a / 255;
  }

  const out = scratch.edgeCtx.createImageData(sw, sh);
  const dest = out.data;
  const lastX = sw - 1;
  const lastY = sh - 1;
  const sample = (map: Float32Array, x: number, y: number) =>
    map[y * sw + x] ?? 0;

  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      let gxA = 0;
      let gyA = 0;
      let gxL = 0;
      let gyL = 0;
      if (x > 0 && x < lastX && y > 0 && y < lastY) {
        const aNw = sample(alpha, x - 1, y - 1);
        const aN = sample(alpha, x, y - 1);
        const aNe = sample(alpha, x + 1, y - 1);
        const aW = sample(alpha, x - 1, y);
        const aE = sample(alpha, x + 1, y);
        const aSw = sample(alpha, x - 1, y + 1);
        const aS = sample(alpha, x, y + 1);
        const aSe = sample(alpha, x + 1, y + 1);
        gxA = -aNw + aNe - 2 * aW + 2 * aE - aSw + aSe;
        gyA = -aNw - 2 * aN - aNe + aSw + 2 * aS + aSe;
        const lNw = sample(lum, x - 1, y - 1);
        const lN = sample(lum, x, y - 1);
        const lNe = sample(lum, x + 1, y - 1);
        const lW = sample(lum, x - 1, y);
        const lE = sample(lum, x + 1, y);
        const lSw = sample(lum, x - 1, y + 1);
        const lS = sample(lum, x, y + 1);
        const lSe = sample(lum, x + 1, y + 1);
        gxL = -lNw + lNe - 2 * lW + 2 * lE - lSw + lSe;
        gyL = -lNw - 2 * lN - lNe + lSw + 2 * lS + lSe;
      }
      const cover = sample(alpha, x, y);
      const silhouette = Math.min(1, Math.hypot(gxA, gyA) * 1.55);
      const crease = Math.min(1, Math.hypot(gxL, gyL) * 1.05) * cover;
      const edge = Math.min(1, silhouette * 1.05 + crease * 0.55);
      const offset = (y * sw + x) * 4;
      if (edge < 0.22) {
        dest[offset + 3] = 0;
        continue;
      }
      dest[offset] = Math.round(118 + edge * 42);
      dest[offset + 1] = Math.round(168 + edge * 38);
      dest[offset + 2] = Math.round(214 + edge * 28);
      dest[offset + 3] = Math.round(Math.min(1, edge) * 220);
    }
  }

  scratch.edgeCtx.putImageData(out, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratch.edge, x0, y0);
}

export function paintXrayHole(frame: XrayPaint): void {
  const { ctx, dpr, width, height } = frame;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (frame.radius <= 0 || frame.alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = frame.alpha;
  ctx.fillStyle = frame.fill;
  drawPixelBlob(ctx, frame.pointerX, frame.pointerY, frame.radius, frame.seed);
  ctx.globalCompositeOperation = 'source-atop';
  if (frame.grain) {
    ctx.fillStyle = frame.grain;
    const span = frame.radius * 3;
    ctx.fillRect(
      frame.pointerX - span,
      frame.pointerY - span,
      span * 2,
      span * 2,
    );
  }
  const originX = frame.rocketCx ?? frame.imgX + frame.imgW / 2;
  const originY = frame.rocketCy ?? frame.imgY + frame.imgH / 2;
  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(-(frame.pitch ?? 0));
  ctx.drawImage(
    frame.plate,
    frame.imgX - originX,
    frame.imgY - originY,
    frame.imgW,
    frame.imgH,
  );
  ctx.restore();
  stampHullEdges(ctx, frame);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

type HitScratch = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

let hitScratch: HitScratch | null = null;

function getHitScratch(): HitScratch | null {
  if (hitScratch) return hitScratch;
  const canvas = document.createElement('canvas');
  canvas.width = 12;
  canvas.height = 12;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  hitScratch = { canvas, ctx };
  return hitScratch;
}

// ContactShadows sit around 0.58 opacity. Opaque mesh is 255. Cut
// between them so the puddle under the rocket does not open the hole.
const HULL_HIT_ALPHA = 200;

/**
 * True when the exhibit WebGL canvas has opaque mesh under the pointer.
 * Starfield and the contact shadow stay a miss; fins and the tube count.
 */
export function hitRocketSilhouette(
  rocket: HTMLCanvasElement,
  cssX: number,
  cssY: number,
  cssW: number,
  cssH: number,
  padCss: number,
): boolean {
  if (rocket.width === 0 || rocket.height === 0 || cssW <= 0 || cssH <= 0) {
    return false;
  }
  const scratch = getHitScratch();
  if (!scratch) return false;

  const pad = Math.max(0, padCss);
  const x0 = cssX - pad;
  const y0 = cssY - pad;
  const span = pad * 2 || 1;
  const sx = (x0 / cssW) * rocket.width;
  const sy = (y0 / cssH) * rocket.height;
  const sw = (span / cssW) * rocket.width;
  const sh = (span / cssH) * rocket.height;
  if (sw < 0.5 || sh < 0.5) return false;

  const { canvas, ctx } = scratch;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(rocket, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < pixels.length; i += 4) {
    if ((pixels[i] ?? 0) > HULL_HIT_ALPHA) return true;
  }
  return false;
}

export function syncCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number,
): void {
  const nextW = Math.max(1, Math.round(width * dpr));
  const nextH = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== nextW) canvas.width = nextW;
  if (canvas.height !== nextH) canvas.height = nextH;
}
