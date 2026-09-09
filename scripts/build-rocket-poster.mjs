import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src', 'assets', 'generated');

const BROWSERS = [
  process.env.BROWSER_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const FRAMES = [
  { view: 'flyby', width: 800, height: 2200, resize: { height: 1600 } },
  { view: 'exhibit', width: 2200, height: 800, resize: { width: 1600 } },
];

const MIME = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.html': 'text/html; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.json': 'application/json',
};

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8">
<style>html,body{margin:0;background:transparent}canvas{display:block}</style>
<script type="importmap">{"imports":{
  "three":"/node_modules/three/build/three.module.js",
  "three/addons/":"/node_modules/three/examples/jsm/"
}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const view = new URLSearchParams(location.search).get('view') ?? 'flyby';
const W = innerWidth, H = innerHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = view === 'exhibit' ? 1.0 : 1.2;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
camera.position.z = 4;

const light = (Ctor, args, position) => {
  const l = new Ctor(...args);
  if (position) l.position.set(...position);
  scene.add(l);
};
if (view === 'exhibit') {
  light(THREE.AmbientLight, ['#a8b4c4', 0.2]);
  light(THREE.HemisphereLight, ['#c4d0dc', '#1a1c24', 0.48]);
  light(THREE.DirectionalLight, ['#f4f7fb', 2.15], [-2.4, 3.6, 2.6]);
  light(THREE.DirectionalLight, ['#7eb6f5', 0.95], [3.4, 2.4, -1.6]);
  light(THREE.DirectionalLight, ['#e4ecf4', 0.72], [0.15, 5.4, 0.4]);
  light(THREE.DirectionalLight, ['#9aabbe', 0.46], [0.3, -1.6, 2.4]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.34;
} else {
  light(THREE.HemisphereLight, ['#d0d4d8', '#161616', 0.65]);
  light(THREE.DirectionalLight, ['#ffffff', 3.2], [-2.4, 3.2, 4.2]);
  light(THREE.DirectionalLight, ['#ffffff', 0.55], [3.2, 1.4, 2.2]);
  light(THREE.DirectionalLight, ['#ffffff', 1.1], [1.8, 2, -3.6]);
}

const PAINT = {
  black: { color: '#2a2a2a', roughness: 0.36, metalness: 0 },
  grey: { color: '#6e6e72', roughness: 0.48, metalness: 0.12 },
  orange: { color: '#e65100', roughness: 0.62, metalness: 0 },
};
const paint = (material) => {
  if (!material.isMeshStandardMaterial) return;
  material.side = THREE.DoubleSide;
  const { r, g, b } = material.color;
  const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const finish = lum < 0.2 ? PAINT.black : chroma < 0.08 ? PAINT.grey : PAINT.orange;
  material.color.set(finish.color);
  material.roughness = Math.min(1, finish.roughness + (view === 'exhibit' ? 0.12 : 0));
  material.metalness = finish.metalness;
};

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.loadAsync('/src/assets/generated/rocket.glb');
const model = gltf.scene;
model.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of Array.isArray(o.material) ? o.material : [o.material]) paint(m);
});
const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;

// Vinyl mark, same placement as RocketMark.tsx.
const markImage = await new THREE.TextureLoader().loadAsync('/src/assets/generated/scae-logo.webp');
const pad = document.createElement('canvas');
pad.width = markImage.image.width;
pad.height = markImage.image.height;
const ctx = pad.getContext('2d');
ctx.drawImage(markImage.image, 0, 0);
const pixels = ctx.getImageData(0, 0, pad.width, pad.height);
for (let i = 0; i < pixels.data.length; i += 4) {
  if (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2] < 24) pixels.data[i + 3] = 0;
}
ctx.putImageData(pixels, 0, 0);
const markTexture = new THREE.CanvasTexture(pad);
markTexture.colorSpace = THREE.SRGBColorSpace;
const MARK_R = 0.0565, MARK_H = 0.085, WRAP = MARK_H / MARK_R;
const mark = new THREE.Mesh(
  new THREE.CylinderGeometry(MARK_R, MARK_R, MARK_H, 32, 1, true, -WRAP / 2, WRAP),
  new THREE.MeshStandardMaterial({ map: markTexture, transparent: true, roughness: 0.42, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
);
mark.position.y = 0.82;
mark.renderOrder = 1;

const viewH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(15));
const viewW = viewH * (W / H);
const scale = view === 'exhibit' ? (viewW * 0.96) / height : (viewH * 0.96) / height;

const group = new THREE.Group();
group.scale.setScalar(scale);
const tilt = new THREE.Group();
tilt.rotation.z = view === 'exhibit' ? -Math.PI / 2 : 0;
const body = new THREE.Group();
body.position.y = -height / 2;
body.add(model, mark);
tilt.add(body);
group.add(tilt);
scene.add(group);

renderer.render(scene, camera);
document.title = 'poster-ready';
</script></body></html>`;

function findBrowser() {
  const bin = BROWSERS.find((candidate) => existsSync(candidate));
  if (!bin) {
    throw new Error(
      'No Chromium found. Set BROWSER_BIN to a chrome.exe / msedge.exe path.',
    );
  }
  return bin;
}

function serve() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/poster.html') {
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(PAGE);
      return;
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.join(root, rel);
    const allowed =
      !rel.includes('..') &&
      (rel.startsWith('node_modules/three/') ||
        rel.startsWith('src/assets/generated/'));
    if (!allowed) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function screenshot(bin, profile, url, out, width, height) {
  const args = [
    '--headless=new',
    '--no-first-run',
    '--no-sandbox',
    '--disable-extensions',
    '--hide-scrollbars',
    '--use-gl=angle',
    '--use-angle=d3d11',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
    '--default-background-color=00000000',
    '--virtual-time-budget=20000',
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    `--screenshot=${out}`,
    url,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`browser exit ${code}`)),
    );
  });
}

async function main() {
  const bin = findBrowser();
  const { server, port } = await serve();
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'scae-poster-'));
  try {
    for (const frame of FRAMES) {
      const raw = path.join(tmp, `${frame.view}.png`);
      const url = `http://127.0.0.1:${port}/poster.html?view=${frame.view}`;
      await screenshot(
        bin,
        path.join(tmp, `profile-${frame.view}`),
        url,
        raw,
        frame.width,
        frame.height,
      );
      const out = path.join(outDir, `rocket-poster-${frame.view}.webp`);
      const image = sharp(raw).trim({ threshold: 8 });
      const buffer = await image
        .resize(frame.resize)
        .webp({ quality: 82, alphaQuality: 90, effort: 6 })
        .toBuffer();
      await writeFile(out, buffer);
      const meta = await sharp(buffer).metadata();
      const size = (await stat(out)).size;
      console.log(
        `${path.relative(root, out)}  ${meta.width}x${meta.height}  ${(size / 1024).toFixed(1)} KB`,
      );
    }
  } finally {
    server.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

await main();
