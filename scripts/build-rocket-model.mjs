/**
 * Turns the Onshape assembly export into a web-ready rocket model.
 *
 * Onshape writes one primitive per CAD face, which lands at ~385 draw calls,
 * keeps every node transform live, and stands the rocket along +Z with the
 * origin somewhere inside the airframe. This bakes all of that down: faces
 * are merged per part, the mesh is re-oriented nose-up along +Y, centred on
 * its own axis with the tail at y = 0, and the buffers are Meshopt-compressed.
 *
 * KEEP_NAMED_PARTS (default true) leaves the 9 CAD parts as separate nodes
 * so the hero can explode them. Set false and rebuild to restore the old
 * one-blob, join-by-material model. The previous blob is also kept as
 * src/assets/generated/rocket-joined.glb.
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

// false = old join-by-material blob. true = 9 independently movable parts.
const KEEP_NAMED_PARTS = true;

/**
 * Onshape part names → stable ids the scene looks up. Match is on the node
 * name, or a parent "occurrence of …" name that still contains the CAD string.
 */
const PART_IDS = {
  'перо 1 ново': 'fin-neg-x',
  'перо 2 ново': 'fin-pos-z',
  'перо 3 ново': 'fin-pos-x',
  'перо 4 ново': 'fin-neg-z',
  дъно: 'tail',
  фузелаж: 'fuselage',
  кейс: 'case',
  електроника_държач: 'bay',
  'Part 1': 'nose',
};

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

function partIdFor(name) {
  if (name in PART_IDS) return PART_IDS[name];
  for (const [cad, id] of Object.entries(PART_IDS)) {
    if (name.includes(cad)) return id;
  }
  return null;
}

function renameParts(document) {
  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const id = partIdFor(node.getName());
    if (!id) {
      throw new Error(`Unmapped rocket part node: ${JSON.stringify(node.getName())}`);
    }
    node.setName(id);
    node.getMesh()?.setName(id);
  }
}

async function main() {
  await MeshoptEncoder.ready;

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const document = await io.read(SOURCE);
  const scene = document.getRoot().getDefaultScene();

  await document.transform(flatten());
  for (const node of document.getRoot().listNodes()) clearNodeTransform(node);
  await document.transform(
    dedup(),
    KEEP_NAMED_PARTS ? join({ keepMeshes: true }) : join(),
    weld(),
    prune(),
    unpartition(),
  );

  if (KEEP_NAMED_PARTS) renameParts(document);

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
  const names = document
    .getRoot()
    .listNodes()
    .filter((node) => node.getMesh())
    .map((node) => node.getName());
  console.log(`rocket.glb: ${(size / 1024).toFixed(1)} KB`);
  console.log(`primitives: ${primitives}`);
  console.log(`parts: ${names.join(', ')}`);
  console.log(`bounds: ${JSON.stringify(bounds)}`);
}

await main();
