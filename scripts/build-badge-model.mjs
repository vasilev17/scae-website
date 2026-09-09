import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(root, 'src/assets/3D-models/lanyard-card.glb');
const LOGO = path.join(root, 'src/assets/generated/scae-logo.webp');
const OUT_DIR = path.join(root, 'src/assets/generated');
const OUT_FILE = path.join(OUT_DIR, 'badge-card.glb');

const ATLAS = 1024;
// Unprinted corner of the 1678px source atlas, stretched back over the card.
const PAPER = { left: 80, top: 1220, width: 420, height: 420 };

const FRONT = { x: 0, y: 0, w: 0.5, h: 0.755 };
const BACK = { x: 0.5, y: 0, w: 0.5, h: 0.757 };

function markPlacement(rect, share) {
  const rx = Math.round(rect.x * ATLAS);
  const ry = Math.round(rect.y * ATLAS);
  const rw = Math.round(rect.w * ATLAS);
  const rh = Math.round(rect.h * ATLAS);
  const size = Math.round(rw * share);
  return {
    size,
    left: rx + Math.round((rw - size) / 2),
    top: ry + Math.round((rh - size) / 2),
  };
}

async function buildAtlas(sourceTexture) {
  const paper = await sharp(sourceTexture)
    .extract(PAPER)
    .resize(ATLAS, ATLAS)
    .png()
    .toBuffer();

  const front = markPlacement(FRONT, 0.78);
  const back = markPlacement(BACK, 0.44);

  const mark = async (size) =>
    sharp(LOGO).resize(size, size, { fit: 'contain' }).png().toBuffer();

  return sharp({
    create: {
      width: ATLAS,
      height: ATLAS,
      channels: 4,
      background: '#ffffff',
    },
  })
    .composite([
      { input: paper },
      { input: await mark(front.size), left: front.left, top: front.top },
      { input: await mark(back.size), left: back.left, top: back.top },
    ])
    .webp({ quality: 90 })
    .toBuffer();
}

async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  const document = await io.read(SOURCE);
  await document.transform(dedup(), weld(), prune());

  const texture = document.getRoot().listTextures()[0];
  if (!texture) throw new Error('Badge source has no card atlas');

  const atlas = await buildAtlas(Buffer.from(texture.getImage()));
  texture.setImage(atlas).setMimeType('image/webp');

  await mkdir(OUT_DIR, { recursive: true });
  await io.write(OUT_FILE, document);

  const { size } = await stat(OUT_FILE);
  console.log(`${path.basename(OUT_FILE)}: ${(size / 1024).toFixed(1)} KB`);
}

await main();
