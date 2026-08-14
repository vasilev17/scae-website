import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo } from 'react';
import {
  ACESFilmicToneMapping,
  Box3,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import rocketUrl from '@/assets/generated/rocket.glb?url';

// Built by scripts/build-rocket-model.mjs: nose up along +Y, tail on the
// origin, Meshopt-compressed. Wired by hand rather than drei's useGLTF, which
// attaches a Draco decoder fetched from a gstatic CDN.
function withMeshopt(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

const FOV = 30;
const CAMERA_DISTANCE = 4;

// Nose this far down the viewport. Low enough that the orange band clears the
// bottom pane — a black-only crop reads as a hole in the starfield.
const NOSE_TIP = 0.5;

// Workshop paint from the real airframe. CAD black is RGB 0,0,0, which cannot
// catch light, so the satin black is lifted just enough to hold a highlight.
const PAINT = {
  black: { color: '#2a2a2a', roughness: 0.36, metalness: 0 },
  orange: { color: '#e65100', roughness: 0.62, metalness: 0 },
} as const;

function paint(material: Material) {
  if (!(material instanceof MeshStandardMaterial)) return;
  material.side = DoubleSide;
  material.metalness = 0;
  const lum =
    material.color.r * 0.2126 +
    material.color.g * 0.7152 +
    material.color.b * 0.0722;
  const finish = lum < 0.2 ? PAINT.black : PAINT.orange;
  material.color.set(finish.color);
  material.roughness = finish.roughness;
}

function Rocket() {
  const gltf = useLoader(GLTFLoader, rocketUrl, withMeshopt);
  const viewport = useThree((state) => state.viewport);
  const invalidate = useThree((state) => state.invalidate);

  const { model, height, materials } = useMemo(() => {
    const model = gltf.scene.clone(true);
    const materials: Material[] = [];

    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const source = object.material;
      const clones = (Array.isArray(source) ? source : [source]).map((mat) => {
        const next = mat.clone();
        paint(next);
        materials.push(next);
        return next;
      });
      object.material = Array.isArray(source) ? clones : clones[0];
    });

    const height = new Box3().setFromObject(model).getSize(new Vector3()).y;
    return { model, height, materials };
  }, [gltf]);

  useEffect(() => {
    invalidate();
    return () => {
      for (const material of materials) material.dispose();
    };
  }, [invalidate, materials]);

  if (height === 0) return null;

  const scale = viewport.height / height;

  return (
    <group
      scale={scale}
      position={[0, viewport.height * (0.5 - NOSE_TIP - 1), 0]}
    >
      <primitive object={model} />
    </group>
  );
}

export function RocketScene() {
  return (
    <Canvas
      className="h-full w-full"
      frameloop="always"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: FOV, position: [0, 0, CAMERA_DISTANCE] }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.2;
      }}
    >
      {/* Soft shop fill so the shadow side of the black nose still reads. */}
      <hemisphereLight args={['#d0d4d8', '#161616', 0.65]} />
      {/* Key, front-left: the vertical streak that turns the cylinder. */}
      <directionalLight position={[-2.4, 3.2, 4.2]} intensity={3.2} />
      {/* Weak fill, opposite side. */}
      <directionalLight position={[3.2, 1.4, 2.2]} intensity={0.55} />
      {/* Rim from behind, separates black paint from the starfield. */}
      <directionalLight position={[1.8, 2, -3.6]} intensity={1.1} />
      <Suspense fallback={null}>
        <Rocket />
      </Suspense>
    </Canvas>
  );
}
