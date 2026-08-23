import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import {
  ACESFilmicToneMapping,
  Box3,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
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
  EXHIBIT_LAYER_CUT,
  EXHIBIT_LAYER_HULL,
  EXHIBIT_X,
  EXHIBIT_Y,
  REST_SECTION,
  type RocketPose,
  type RocketView,
  type SectionState,
} from '@/lib/rocket';
import {
  explodeTravel,
  isRocketPartId,
  NOSE_SEAT,
  ROCKET_DISASSEMBLE,
  ROCKET_PART_OFFSETS,
  type RocketPartId,
} from '@/lib/rocket-disassemble';
import { paintRocketMaterial, setCutOpacity } from '@/lib/rocket-paint';
import { ROCKET_PORTAL } from '@/lib/rocket-portal';

// Built by scripts/build-rocket-model.mjs: nose up along +Y, tail on the
// origin, Meshopt-compressed. Wired by hand rather than drei's useGLTF, which
// attaches a Draco decoder fetched from a gstatic CDN.
function withMeshopt(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

const FOV = 30;
const CAMERA_DISTANCE = 4;

const SHADOW_OPACITY = 0.58;
const SHADOW_BLUR = 2.6;
const SHADOW_SCALE = 2.6;
const SHADOW_FAR = 0.55;
const SHADOW_COLOR = '#1a1210';

function assignLayer(object: Object3D, layer: number) {
  object.traverse((child) => {
    child.layers.set(layer);
  });
}

function setShadowOpacity(group: Group | null, opacity: number) {
  if (!group) return;
  for (const child of group.children) {
    if (!(child instanceof Mesh)) continue;
    if (!(child.material instanceof MeshBasicMaterial)) continue;
    child.material.opacity = opacity;
  }
}

function maskShadowCamera(group: Group | null, layer: number) {
  if (!group) return;
  for (const child of group.children) {
    if (!(child instanceof OrthographicCamera)) continue;
    child.layers.disableAll();
    child.layers.enable(0);
    child.layers.enable(layer);
  }
}

type ExhibitShadowProps = {
  shadowRef: RefObject<Group | null>;
  layer: number;
};

// Depth pass ignores opacity, so one map per silhouette. Opacity follows
// `cut` in useFrame and matches the 0.4s section crossfade.
// Infinity: drei bakes `frames={1}` on the first tick, often before this
// camera sees layer 1, and a later React render recaptures while the hull
// is hidden. Keep sampling so the parked rocket always has a map.
function ExhibitShadow({ shadowRef, layer }: ExhibitShadowProps) {
  useFrame(() => {
    maskShadowCamera(shadowRef.current, layer);
  });
  return (
    <ContactShadows
      ref={shadowRef}
      position={[0, -STAND_HEIGHT - 0.012, 0]}
      opacity={SHADOW_OPACITY}
      scale={SHADOW_SCALE}
      blur={SHADOW_BLUR}
      far={SHADOW_FAR}
      frames={Infinity}
      resolution={512}
      color={SHADOW_COLOR}
    />
  );
}

// Nose this far down the viewport. Low enough that the orange band clears the
// bottom pane — a black-only crop reads as a hole in the starfield.
const NOSE_TIP = 0.5;

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

const ExhibitSection = lazy(() =>
  import('@/components/ui/ExhibitSection').then((mod) => ({
    default: mod.ExhibitSection,
  })),
);

type RocketPart = {
  id: RocketPartId;
  object: Object3D;
  rest: readonly [number, number, number];
};

type RocketProps = {
  poseRef: RefObject<RocketPose>;
  view: RocketView;
  sectionRef: RefObject<SectionState>;
};

function Rocket({ poseRef, view, sectionRef }: RocketProps) {
  const gltf = useLoader(GLTFLoader, rocketUrl, withMeshopt);
  const viewport = useThree((state) => state.viewport);
  const invalidate = useThree((state) => state.invalidate);
  const groupRef = useRef<Group>(null);
  const tiltRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const assembledRef = useRef<Group>(null);
  const markGroupRef = useRef<Group>(null);
  const hullShadowRef = useRef<Group>(null);
  const cutShadowRef = useRef<Group>(null);

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
        paintRocketMaterial(next, view);
        if (view === 'exhibit') next.transparent = true;
        materials.push(next);
        return next;
      });
      object.material = Array.isArray(source) ? clones : clones[0];
    });

    const height = new Box3().setFromObject(model).getSize(new Vector3()).y;
    if (view === 'exhibit') assignLayer(model, EXHIBIT_LAYER_HULL);
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
    const cut = view === 'exhibit' ? sectionRef.current.cut : 0;
    const mark = markGroupRef.current;
    if (mark) {
      const [x, y, z] = ROCKET_PART_OFFSETS.bay;
      mark.position.set(x * amount, y * amount, z * amount);
      mark.visible = cut < 0.5;
    }

    if (view === 'exhibit') {
      setCutOpacity(materials, 1 - cut, cut < 0.5);
      if (assembledRef.current) assembledRef.current.visible = cut < 0.999;
      setShadowOpacity(hullShadowRef.current, SHADOW_OPACITY * (1 - cut));
      setShadowOpacity(cutShadowRef.current, SHADOW_OPACITY * cut);
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
          <group ref={assembledRef}>
            <primitive object={model} />
          </group>
          {view === 'exhibit' ? (
            <Suspense fallback={null}>
              <ExhibitSection view={view} sectionRef={sectionRef} />
            </Suspense>
          ) : null}
          {ROCKET_MARK_ENABLED ? (
            <group
              ref={markGroupRef}
              onUpdate={(group) => assignLayer(group, EXHIBIT_LAYER_HULL)}
            >
              <Suspense fallback={null}>
                <RocketMark />
              </Suspense>
            </group>
          ) : null}
        </group>
      </group>
      {view === 'exhibit' ? <RocketStands length={height} /> : null}
      {view === 'exhibit' ? (
        <>
          <ExhibitShadow
            shadowRef={hullShadowRef}
            layer={EXHIBIT_LAYER_HULL}
          />
          <ExhibitShadow
            shadowRef={cutShadowRef}
            layer={EXHIBIT_LAYER_CUT}
          />
        </>
      ) : null}
    </group>
  );
}

type RocketSceneProps = {
  poseRef: RefObject<RocketPose>;
  view?: RocketView;
  sectionRef?: RefObject<SectionState>;
};

export function RocketScene({
  poseRef,
  view = 'flyby',
  sectionRef,
}: RocketSceneProps) {
  const cutRef = sectionRef ?? { current: REST_SECTION };
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
      onCreated={({ gl, camera }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = view === 'exhibit' ? 1.02 : 1.2;
        camera.layers.enable(EXHIBIT_LAYER_HULL);
        camera.layers.enable(EXHIBIT_LAYER_CUT);
      }}
    >
      {view === 'exhibit' ? <ExhibitRig /> : <FlybyLights />}
      <Suspense fallback={null}>
        <Rocket poseRef={poseRef} view={view} sectionRef={cutRef} />
      </Suspense>
    </Canvas>
  );
}
