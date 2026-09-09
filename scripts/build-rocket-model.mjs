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
const SECTION_SOURCE = path.join(
  root,
  'src/assets/3D-models/assembly - commodore - min section view.glb',
);
const OUT_DIR = path.join(root, 'src/assets/generated');
const OUT_FILE = path.join(OUT_DIR, 'rocket.glb');
const SECTION_OUT_FILE = path.join(OUT_DIR, 'rocket-section.glb');

// false = old join-by-material blob. true = 9 independently movable parts.
const KEEP_NAMED_PARTS = true;

// Section internals kept out of the material join so runtime paint can hit them.
const SECTION_STEEL = {
  шпилка: 'stud',
};

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

function isSectionSteel(name) {
  return name in SECTION_STEEL;
}

function renameSectionSteel(document) {
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const id = SECTION_STEEL[node.getName()];
    if (!id) continue;
    node.setName(id);
    mesh.setName(id);
    for (const prim of mesh.listPrimitives()) {
      prim.getMaterial()?.setName(id);
    }
  }
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

function meshBounds(document, needle) {
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || !node.getName().includes(needle)) continue;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const point = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i += 1) {
        pos.getElement(i, point);
        for (let k = 0; k < 3; k += 1) {
          const value = point[k] ?? 0;
          if (value < min[k]) min[k] = value;
          if (value > max[k]) max[k] = value;
        }
      }
    }
    return { min, max };
  }
  throw new Error(`Missing part ${JSON.stringify(needle)} for section align`);
}

function translation(dx, dy, dz) {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, dx, dy, dz, 1];
}

function faceCamera() {
  return [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1];
}

function sectionAlign(assembled, section) {
  const full = meshBounds(assembled, 'фузелаж');
  const cut = meshBounds(section, 'фузелаж');
  const axisY = (full.min[1] + full.max[1]) / 2;
  return translation(
    full.min[0] - cut.min[0],
    axisY - cut.max[1],
    full.min[2] - cut.min[2],
  );
}

async function prepare(document, keepNamedParts) {
  await document.transform(flatten());
  for (const node of document.getRoot().listNodes()) clearNodeTransform(node);
  await document.transform(
    dedup(),
    keepNamedParts ? join({ keepMeshes: true }) : join(),
    weld(),
    prune(),
    unpartition(),
  );
}

function applyFrame(document, matrix) {
  for (const mesh of document.getRoot().listMeshes()) {
    transformMesh(mesh, matrix);
  }
  for (const material of document.getRoot().listMaterials()) {
    material.setDoubleSided(true);
  }
}

async function compressWrite(io, document, outFile) {
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write(outFile, document);
  const primitives = document
    .getRoot()
    .listMeshes()
    .reduce((total, mesh) => total + mesh.listPrimitives().length, 0);
  const scene = document.getRoot().getDefaultScene();
  const bounds = getBounds(scene);
  const { size } = await stat(outFile);
  const names = document
    .getRoot()
    .listNodes()
    .filter((node) => node.getMesh())
    .map((node) => node.getName());
  console.log(`${path.basename(outFile)}: ${(size / 1024).toFixed(1)} KB`);
  console.log(`primitives: ${primitives}`);
  console.log(`parts: ${names.join(', ')}`);
  console.log(`bounds: ${JSON.stringify(bounds)}`);
}

async function main() {
  await MeshoptEncoder.ready;

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

  const assembled = await io.read(SOURCE);
  await prepare(assembled, KEEP_NAMED_PARTS);

  const section = await io.read(SECTION_SOURCE);
  await prepare(section, true);

  const align = sectionAlign(assembled, section);
  const matrix = orientation(getBounds(assembled.getRoot().getDefaultScene()));
  if (KEEP_NAMED_PARTS) renameParts(assembled);
  applyFrame(assembled, matrix);
  applyFrame(section, align);
  applyFrame(section, matrix);
  applyFrame(section, faceCamera());
  await section.transform(
    join({ filter: (node) => !isSectionSteel(node.getName()) }),
    prune(),
  );
  renameSectionSteel(section);

  await mkdir(OUT_DIR, { recursive: true });
  await compressWrite(io, assembled, OUT_FILE);
  await compressWrite(io, section, SECTION_OUT_FILE);
}

await main();
