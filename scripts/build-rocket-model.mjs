/**
 * Turns the Onshape assembly export into a web-ready rocket model.
 *
 * Onshape writes one primitive per CAD face, which lands at ~385 draw calls,
 * keeps every node transform live, and stands the rocket along +Z with the
 * origin somewhere inside the airframe. This bakes all of that down: parts are
 * merged per material, the mesh is re-oriented nose-up along +Y, centred on its
 * own axis with the tail at y = 0, and the buffers are Meshopt-compressed.
 *
 * The component that renders it can then treat the model as a unit-placed prop
 * instead of carrying correction transforms.
 *
 * Run: node scripts/build-rocket-model.mjs
 */

import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getBounds, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  clearNodeTransform,
  dedup,
  flatten,
  join,
  meshopt,
  prune,
  transformMesh,
  unpartition,
  weld,
} from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(
  root,
  'src/assets/3D-models/assembly - commodore - min.glb',
);
const OUT_DIR = path.join(root, 'src/assets/generated');
const OUT_FILE = path.join(OUT_DIR, 'rocket.glb');

/**
 * Column-major transform taking the CAD frame (nose along +Z, arbitrary origin)
 * to ours (nose along +Y, tail at the origin, centred on the other two axes).
 */
function orientation(bounds) {
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  const tailZ = bounds.min[2];

  // A -90 degree turn about X, so +Z becomes +Y, then the recentring offset.
  // prettier-ignore
  return [
    1, 0, 0, 0,
    0, 0, -1, 0,
    0, 1, 0, 0,
    -centerX, -tailZ, centerY, 1,
  ];
}

async function main() {
  await MeshoptEncoder.ready;

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const document = await io.read(SOURCE);
  const scene = document.getRoot().getDefaultScene();

  // Hoisting then baking every node transform is what lets `join` merge parts
  // that only differ by placement.
  await document.transform(flatten());
  for (const node of document.getRoot().listNodes()) clearNodeTransform(node);
  await document.transform(dedup(), join(), weld(), prune(), unpartition());

  const matrix = orientation(getBounds(scene));
  for (const mesh of document.getRoot().listMeshes()) {
    transformMesh(mesh, matrix);
  }

  // Onshape windings are unreliable. Keep both sides so a flipped face
  // cannot eat the nose or a fin.
  for (const material of document.getRoot().listMaterials()) {
    material.setDoubleSided(true);
  }

  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));

  await mkdir(OUT_DIR, { recursive: true });
  await io.write(OUT_FILE, document);

  const primitives = document
    .getRoot()
    .listMeshes()
    .reduce((total, mesh) => total + mesh.listPrimitives().length, 0);
  const bounds = getBounds(scene);
  const { size } = await stat(OUT_FILE);
  console.log(`rocket.glb: ${(size / 1024).toFixed(1)} KB`);
  console.log(`primitives: ${primitives}`);
  console.log(`bounds: ${JSON.stringify(bounds)}`);
}

await main();
