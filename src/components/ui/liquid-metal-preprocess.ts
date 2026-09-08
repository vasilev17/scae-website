// Shader: paper.design Liquid Metal preprocess (MIT). Host rewritten for SCAE.  Adapted: 2026-09-08
// Poisson-solves a shape mask. White-on-dark logos count as inside (SCAE mark).

const MAX_SIZE = 560;
const MIN_SIZE = 420;
const ITERATIONS = 220;
const CHARGE = 0.01;
const REMAP = 2;
const LUM_CUTOFF = 24;

function fitSize(width: number, height: number) {
  let nextWidth = width;
  let nextHeight = height;
  const long = Math.max(nextWidth, nextHeight);
  const short = Math.min(nextWidth, nextHeight);

  if (long > MAX_SIZE) {
    const scale = MAX_SIZE / long;
    nextWidth = Math.max(1, Math.round(nextWidth * scale));
    nextHeight = Math.max(1, Math.round(nextHeight * scale));
  } else if (short < MIN_SIZE) {
    const scale = MIN_SIZE / short;
    nextWidth = Math.max(1, Math.round(nextWidth * scale));
    nextHeight = Math.max(1, Math.round(nextHeight * scale));
  }

  return { width: nextWidth, height: nextHeight };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load liquid-metal image'));
    image.src = src;
  });
}

export async function processLiquidMetalImage(src: string) {
  const image = await loadImage(src);
  const fitted = fitSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const width = fitted.width;
  const height = fitted.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  ctx.drawImage(image, 0, 0, width, height);
  const shape = ctx.getImageData(0, 0, width, height);
  const pixels = shape.data;
  const count = width * height;
  const mask = new Uint8Array(count);
  const boundary = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    const px = i * 4;
    const r = pixels[px] ?? 0;
    const g = pixels[px + 1] ?? 0;
    const b = pixels[px + 2] ?? 0;
    const a = pixels[px + 3] ?? 0;
    // Transparent or near-black field stays outside; the white mark and navy disc stay in.
    mask[i] = a > 16 && r + g + b > LUM_CUTOFF ? 1 : 0;
  }

  const inside = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return mask[y * width + x] === 1;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] !== 1) continue;
      let edge = false;
      for (let ny = y - 1; ny <= y + 1 && !edge; ny++) {
        for (let nx = x - 1; nx <= x + 1 && !edge; nx++) {
          if (!inside(nx, ny)) edge = true;
        }
      }
      if (edge) boundary[idx] = 1;
    }
  }

  const field = new Float32Array(count);
  const next = new Float32Array(count);
  const sample = (x: number, y: number, data: Float32Array) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    if (mask[y * width + x] !== 1) return 0;
    return data[y * width + x] ?? 0;
  };

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (mask[idx] !== 1 || boundary[idx] === 1) {
          next[idx] = 0;
          continue;
        }
        next[idx] =
          (CHARGE +
            sample(x + 1, y, field) +
            sample(x - 1, y, field) +
            sample(x, y + 1, field) +
            sample(x, y - 1, field)) /
          4;
      }
    }
    field.set(next);
  }

  let maxVal = 0;
  for (let i = 0; i < count; i++) {
    const value = field[i] ?? 0;
    if (value > maxVal) maxVal = value;
  }

  const out = ctx.createImageData(width, height);
  const dest = out.data;
  for (let i = 0; i < count; i++) {
    const px = i * 4;
    if (mask[i] !== 1) {
      dest[px] = 255;
      dest[px + 1] = 255;
      dest[px + 2] = 255;
      dest[px + 3] = 255;
      continue;
    }
    const raw = maxVal > 0 ? (field[i] ?? 0) / maxVal : 0;
    const gray = 255 * (1 - Math.pow(raw, REMAP));
    dest[px] = gray;
    dest[px + 1] = gray;
    dest[px + 2] = gray;
    dest[px + 3] = 255;
  }

  return out;
}
