import {
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  type Material,
  type Object3D,
} from 'three';

import { type RocketView } from '@/lib/rocket';

// Workshop paint from the real airframe. CAD black is RGB 0,0,0, which cannot
// catch light, so the satin black is lifted just enough to hold a highlight.
const PAINT = {
  black: { color: '#2a2a2a', roughness: 0.36, metalness: 0 },
  grey: { color: '#6e6e72', roughness: 0.48, metalness: 0.12 },
  orange: { color: '#e65100', roughness: 0.62, metalness: 0 },
  // Section-view stud. CAD blue mapped to orange and vanished on the tube.
  steel: { color: '#c9d0d8', roughness: 0.32, metalness: 0.55 },
} as const;

type PaintFinish = keyof typeof PAINT;

const STEEL_PARTS = new Set(['stud', 'шпилка']);

export function paintRocketMaterial(
  material: Material,
  view: RocketView,
  finishName?: PaintFinish,
) {
  if (!(material instanceof MeshStandardMaterial)) return;
  material.side = DoubleSide;
  const { r, g, b } = material.color;
  const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const finish =
    finishName && finishName in PAINT
      ? PAINT[finishName]
      : lum < 0.2
        ? PAINT.black
        : chroma < 0.08
          ? PAINT.grey
          : PAINT.orange;
  material.color.set(finish.color);
  const rough = view === 'exhibit' ? 0.12 : 0;
  material.roughness = Math.min(1, finish.roughness + rough);
  material.metalness = finish.metalness;
}

function steelPart(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (STEEL_PARTS.has(current.name)) return true;
    const cadName = current.userData.name;
    if (typeof cadName === 'string' && STEEL_PARTS.has(cadName)) return true;
    current = current.parent;
  }
  return false;
}

export function clonePaintedMaterials(
  object: Object3D,
  view: RocketView,
): Material[] {
  const materials: Material[] = [];
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const finish = steelPart(child) ? 'steel' : undefined;
    const source = child.material;
    const clones = (Array.isArray(source) ? source : [source]).map((mat) => {
      const next = mat.clone();
      paintRocketMaterial(next, view, finish);
      next.transparent = true;
      materials.push(next);
      return next;
    });
    child.material = Array.isArray(source) ? clones : clones[0];
  });
  return materials;
}

export function setCutOpacity(
  materials: Material[],
  opacity: number,
  writeDepth: boolean,
) {
  for (const material of materials) {
    if (!(material instanceof MeshStandardMaterial)) continue;
    material.opacity = opacity;
    material.depthWrite = writeDepth;
  }
}
