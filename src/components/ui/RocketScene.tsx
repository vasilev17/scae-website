import {
  Canvas,
  useFrame,
  useLoader,
  useThree,
} from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  ACESFilmicToneMapping,
  Box3,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Material,
} from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import rocketUrl from '@/assets/generated/rocket.glb?url';
import { ROCKET_MARK_ENABLED, RocketMark } from '@/components/ui/RocketMark';
import { type RocketPose } from '@/lib/rocket';
import {
  isRocketPartId,
  ROCKET_DISASSEMBLE,
  ROCKET_PART_OFFSETS,
  type RocketPartId,
} from '@/lib/rocket-disassemble';
import { ROCKET_PORTAL } from '@/lib/rocket-portal';

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
  grey: { color: '#6e6e72', roughness: 0.48, metalness: 0.12 },
  orange: { color: '#e65100', roughness: 0.62, metalness: 0 },
} as const;

function paint(material: Material) {
  if (!(material instanceof MeshStandardMaterial)) return;
  material.side = DoubleSide;
  const { r, g, b } = material.color;
  const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const finish =
    lum < 0.2 ? PAINT.black : chroma < 0.08 ? PAINT.grey : PAINT.orange;
  material.color.set(finish.color);
  material.roughness = finish.roughness;
  material.metalness = finish.metalness;
}

type RocketPart = {
  id: RocketPartId;
  object: Object3D;
  rest: readonly [number, number, number];
};

type RocketProps = {
  poseRef: RefObject<RocketPose>;
};

function Rocket({ poseRef }: RocketProps) {
  const gltf = useLoader(GLTFLoader, rocketUrl, withMeshopt);
  const viewport = useThree((state) => state.viewport);
  const invalidate = useThree((state) => state.invalidate);
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const markGroupRef = useRef<Group>(null);

  const { model, height, materials, parts } = useMemo(() => {
    const model = gltf.scene.clone(true);
    const materials: Material[] = [];
    const parts: RocketPart[] = [];

    model.traverse((object) => {
      if (isRocketPartId(object.name)) {
        const parentName = object.parent?.name ?? '';
        if (!isRocketPartId(parentName)) {
          parts.push({
            id: object.name,
            object,
            rest: [object.position.x, object.position.y, object.position.z],
          });
        }
      }
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
    return { model, height, materials, parts };
  }, [gltf]);

  useEffect(() => {
    invalidate();
    return () => {
      for (const material of materials) material.dispose();
    };
  }, [invalidate, materials]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group || height === 0) return;
    const { lift, tilt, spin, explode } = poseRef.current;
    // Pivot is the airframe centre. Rest parks that centre so the nose still
    // sits at NOSE_TIP; lift 1 puts it on the viewport origin.
    const restY = -viewport.height * NOSE_TIP;
    group.position.y = restY * (1 - lift);
    group.rotation.z = tilt;
    if (bodyRef.current) bodyRef.current.rotation.y = spin;

    const amount =
      ROCKET_DISASSEMBLE && Number.isFinite(explode) ? explode : 0;
    for (const { id, object, rest } of parts) {
      const [x, y, z] = ROCKET_PART_OFFSETS[id];
      object.position.set(rest[0] + x * amount, rest[1] + y * amount, rest[2] + z * amount);
    }
    const mark = markGroupRef.current;
    if (mark) {
      const [x, y, z] = ROCKET_PART_OFFSETS.bay;
      mark.position.set(x * amount, y * amount, z * amount);
    }
  });

  if (height === 0) return null;

  const scale = viewport.height / height;

  return (
    <group ref={groupRef} scale={scale}>
      <group ref={bodyRef} position={[0, -height / 2, 0]}>
        <primitive object={model} />
        {ROCKET_MARK_ENABLED ? (
          <group ref={markGroupRef}>
            <Suspense fallback={null}>
              <RocketMark />
            </Suspense>
          </group>
        ) : null}
      </group>
    </group>
  );
}

type RocketSceneProps = {
  poseRef: RefObject<RocketPose>;
};

export function RocketScene({ poseRef }: RocketSceneProps) {
  return (
    <Canvas
      className="h-full w-full"
      frameloop="always"
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: ROCKET_PORTAL,
      }}
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
        <Rocket poseRef={poseRef} />
      </Suspense>
    </Canvas>
  );
}
