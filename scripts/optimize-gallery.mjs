import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src', 'assets', 'images', 'gallery');
const outDir = path.join(root, 'src', 'assets', 'images', 'gallery-opt');

const KEEP = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.cr2']);
const MAX_EDGE = 1920;

function slugFromName(name) {
  const stem = name.replace(/\.[^.]+$/, '');
  const ascii = stem
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return ascii || 'image';
}

function jpegSlices(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff || buf[i + 1] !== 0xd8) {
      i += 1;
      continue;
    }
    let end = -1;
    for (let j = i + 2; j < buf.length - 1; j += 1) {
      if (buf[j] === 0xff && buf[j + 1] === 0xd9) {
        end = j + 2;
        break;
      }
    }
    if (end > 0) {
      out.push(buf.subarray(i, end));
      i = end;
    } else {
      i += 1;
    }
  }
  return out;
}

async function bestEmbeddedJpeg(buf) {
  let best = null;
  let bestPixels = 0;
  for (const slice of jpegSlices(buf)) {
    try {
      const meta = await sharp(slice, { failOn: 'none' }).metadata();
      const pixels = (meta.width ?? 0) * (meta.height ?? 0);
      if (pixels > bestPixels) {
        best = slice;
        bestPixels = pixels;
      }
    } catch {
      // 14-bit RAW JPEG, skip.
    }
  }
  return best;
}

async function openSource(file, ext) {
  if (ext === '.cr2' || ext === '.heic') {
    const embedded = await bestEmbeddedJpeg(await readFile(file));
    if (embedded) return sharp(embedded, { failOn: 'none' }).rotate();
  }
  return sharp(file, { failOn: 'none' }).rotate();
}

const files = (await readdir(srcDir)).filter((name) =>
  KEEP.has(path.extname(name).toLowerCase()),
);

await mkdir(outDir, { recursive: true });

for (const name of files) {
  const input = path.join(srcDir, name);
  const slug = slugFromName(name);
  const output = path.join(outDir, `${slug}.webp`);
  const ext = path.extname(name).toLowerCase();
  try {
    const image = await openSource(input, ext);
    const meta = await image.metadata();
    const pipeline = image.resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    });
    if ((meta.channels ?? 3) >= 4) {
      pipeline.flatten({ background: '#0b0b0d' });
    }
    const info = await pipeline.webp({ quality: 80 }).toFile(output);
    console.log(
      `${name} -> ${slug}.webp ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : error;
    console.error(`FAIL ${name}: ${reason}`);
  }
}
