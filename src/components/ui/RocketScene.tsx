import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
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
import { RocketStands, STAND_HEIGHT } from '@/components/ui/RocketStand';
import {
  EXHIBIT_FILL,
  EXHIBIT_X,
  EXHIBIT_Y,
  type RocketPose,
  type RocketView,
} from '@/lib/rocket';
import {
  explodeTravel,
  isRocketPartId,
  NOSE_SEAT,
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

function paint(material: Material, view: RocketView) {
  if (!(material instanceof MeshStandardMaterial)) return;
  material.side = DoubleSide;
  const { r, g, b } = material.color;
  const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const finish =
    lum < 0.2 ? PAINT.black : chroma < 0.08 ? PAINT.grey : PAINT.orange;
  material.color.set(finish.color);
  // Tent light is a giant softbox. Extra roughness kills the plastic CG sheen.
  const rough = view === 'exhibit' ? 0.12 : 0;
  material.roughness = Math.min(1, finish.roughness + rough);
  material.metalness = finish.metalness;
}

function FlybyLights() {
  return (
    <>
      {/* Soft shop fill so the shadow side of the black nose still reads. */}
      <hemisphereLight args={['#d0d4d8', '#161616', 0.65]} />
      {/* Key, front-left: the vertical streak that turns the cylinder. */}
      <directionalLight position={[-2.4, 3.2, 4.2]} intensity={3.2} />
      {/* Weak fill, opposite side. */}
      <directionalLight position={[3.2, 1.4, 2.2]} intensity={0.55} />
      {/* Rim from behind, separates black paint from the starfield. */}
      <directionalLight position={[1.8, 2, -3.6]} intensity={1.1} />
    </>
  );
}

function ExhibitRig() {
  return (
    <>
      <ambientLight intensity={0.4} color="#fff4e4" />
      <hemisphereLight args={['#fff7ee', '#6e685c', 0.72]} />
      {/* Tent roof: big overhead softbox. */}
      <directionalLight
        position={[0.4, 4.6, 1.8]}
        intensity={1.15}
        color="#fffaf3"
      />
      {/* Bright rear wall, wrap light from behind. */}
      <directionalLight
        position={[0.2, 1.4, -3.4]}
        intensity={0.55}
        color="#ffffff"
      />
      {/* Weak warm fill from the open front. */}
      <directionalLight
        position={[-2.2, 1.8, 2.8]}
        intensity={0.28}
        color="#ffe8c8"
      />
      <Environment resolution={256} environmentIntensity={0.55}>
        <Lightformer
          intensity={5}
          rotation-x={Math.PI / 2}
          position={[0, 5, 0]}
          scale={[12, 12, 1]}
          color="#fff8ee"
        />
        <Lightformer
          intensity={2.4}
          position={[0, 1, -5]}
          scale={[14, 8, 1]}
          color="#ffffff"
        />
        <Lightformer
          intensity={0.9}
          position={[-5, 1.2, 1]}
          scale={[4, 6, 1]}
          color="#fff1d6"
        />
        <Lightformer
          intensity={0.55}
          position={[5, 1.2, 2]}
          scale={[3, 5, 1]}
          color="#e4e0d6"
        />
      </Environment>
    </>
  );
}

type RocketPart = {
  id: RocketPartId;
  object: Object3D;
  rest: readonly [number, number, number];
};

type RocketProps = {
  poseRef: RefObject<RocketPose>;
  view: RocketView;
};

function Rocket({ poseRef, view }: RocketProps) {
  const gltf = useLoader(GLTFLoader, rocketUrl, withMeshopt);
  const viewport = useThree((state) => state.viewport);
  const invalidate = useThree((state) => state.invalidate);
  const groupRef = useRef<Group>(null);
  const tiltRef = useRef<Group>(null);
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
        paint(next, view);
        materials.push(next);
        return next;
      });
      object.material = Array.isArray(source) ? clones : clones[0];
    });

    const height = new Box3().setFromObject(model).getSize(new Vector3()).y;
    return { model, height, materials, parts };
  }, [gltf, view]);

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
    if (view === 'exhibit') {
      group.position.x = viewport.width * EXHIBIT_X;
      group.position.y = viewport.height * EXHIBIT_Y;
    } else {
      group.position.x = 0;
      group.position.y = restY * (1 - lift);
    }
    if (tiltRef.current) tiltRef.current.rotation.z = tilt;
    if (bodyRef.current) bodyRef.current.rotation.y = spin;

    const amount = ROCKET_DISASSEMBLE && Number.isFinite(explode) ? explode : 0;
    for (const { id, object, rest } of parts) {
      const [x, y, z] = ROCKET_PART_OFFSETS[id];
      const travel = explodeTravel(id, amount);
      const seat = id === 'nose' ? -NOSE_SEAT * (1 - amount) : 0;
      object.position.set(
        rest[0] + x * travel,
        rest[1] + y * travel + seat,
        rest[2] + z * travel,
      );
    }
    const mark = markGroupRef.current;
    if (mark) {
      const [x, y, z] = ROCKET_PART_OFFSETS.bay;
      mark.position.set(x * amount, y * amount, z * amount);
    }
  });

  if (height === 0) return null;

  const scale =
    view === 'exhibit'
      ? (viewport.width * EXHIBIT_FILL) / height
      : viewport.height / height;

  return (
    <group ref={groupRef} scale={scale}>
      <group ref={tiltRef}>
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
      {view === 'exhibit' ? <RocketStands length={height} /> : null}
      {view === 'exhibit' ? (
        <ContactShadows
          // Below the feet. On the plane it z-fights and paints gray cards
          // at the stand bases and the down fin.
          position={[0, -STAND_HEIGHT - 0.012, 0]}
          opacity={0.58}
          scale={2.6}
          blur={2.6}
          far={0.55}
          frames={1}
          resolution={512}
          color="#1a1210"
        />
      ) : null}
    </group>
  );
}

type RocketSceneProps = {
  poseRef: RefObject<RocketPose>;
  view?: RocketView;
};

export function RocketScene({ poseRef, view = 'flyby' }: RocketSceneProps) {
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
        gl.toneMappingExposure = view === 'exhibit' ? 1.02 : 1.2;
      }}
    >
      {view === 'exhibit' ? <ExhibitRig /> : <FlybyLights />}
      <Suspense fallback={null}>
        <Rocket poseRef={poseRef} view={view} />
      </Suspense>
    </Canvas>
  );
}
