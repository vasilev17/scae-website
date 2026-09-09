import { useLoader } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  CanvasTexture,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three';

import markUrl from '@/assets/generated/scae-logo.webp?url';

export const ROCKET_MARK_ENABLED = true;

// Model space, metres. Tail at y = 0, nose at ~1.275.
const Y = 0.82;
const RADIUS = 0.0565;
const HEIGHT = 0.085;
// Arc matches height so the circular mark stays round on the curve.
const WRAP = HEIGHT / RADIUS;
const THETA_START = -WRAP / 2;
const SEGMENTS = 32;

function punchPad(source: Texture): CanvasTexture {
  const image = source.image as HTMLImageElement | ImageBitmap;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new CanvasTexture(canvas);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }

  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    // Drop the square black pad so only the circular mark remains.
    if (r + g + b < 24 && data[i + 3] !== undefined) data[i + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function RocketMark() {
  const source = useLoader(TextureLoader, markUrl);
  const texture = useMemo(() => punchPad(source), [source]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, Y, 0]} renderOrder={1}>
      <cylinderGeometry
        args={[RADIUS, RADIUS, HEIGHT, SEGMENTS, 1, true, THETA_START, WRAP]}
      />
      <meshStandardMaterial
        map={texture}
        transparent
        roughness={0.42}
        metalness={0}
        polygonOffset
        polygonOffsetFactor={-2}
        depthWrite={false}
      />
    </mesh>
  );
}
