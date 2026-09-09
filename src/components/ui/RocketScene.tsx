import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  ACESFilmicToneMapping,
  Box3,
  Group,
  Light,
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
import { qualityBudget, type QualityTier } from '@/lib/quality';
import {
  EXHIBIT_FLOAT_AMP,
  EXHIBIT_FLOAT_PERIOD,
  EXHIBIT_FLOAT_PITCH,
  exhibitFloat,
  EXHIBIT_LAYER_CUT,
  EXHIBIT_LAYER_HULL,
  exhibitRocketLength,
  exhibitRocketOffset,
  exhibitRocketTilt,
  flybyRocketLength,
  EXHIBIT_SHADOWS,
  EXHIBIT_STANDS,
  registerRocketInvalidate,
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

function withMeshopt(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

const FOV = 30;
const CAMERA_DISTANCE = 4;

const SHADOW_OPACITY = 0.62;
const SHADOW_BLUR = 2.6;
const SHADOW_SCALE = 2.6;
const SHADOW_FAR = 0.55;
const SHADOW_COLOR = '#0b0c10';

function assignLayer(object: Object3D, layer: number) {
  object.traverse((child) => {
    child.layers.set(layer);
  });
}

function bindCutLight(light: Light | null) {
  if (!light) return;
  light.layers.disableAll();
  light.layers.enable(EXHIBIT_LAYER_CUT);
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

type ExhibitRigProps = {
  environment: boolean;
};

function ExhibitRig({ environment }: ExhibitRigProps) {
  return (
    <>
      <ambientLight intensity={environment ? 0.2 : 0.34} color="#a8b4c4" />
      <hemisphereLight
        args={['#c4d0dc', '#1a1c24', environment ? 0.48 : 0.6]}
      />
      {/* Key: same side as the white 2D ray. */}
      <directionalLight
        position={[-2.4, 3.6, 2.6]}
        intensity={2.15}
        color="#f4f7fb"
      />
      {/* Cool rim: lifts black nose and fins off the void. */}
      <directionalLight
        position={[3.4, 2.4, -1.6]}
        intensity={0.95}
        color="#7eb6f5"
      />
      {/* Tight top kick so the orange band still turns. */}
      <directionalLight
        position={[0.15, 5.4, 0.4]}
        intensity={0.72}
        color="#e4ecf4"
      />
      {/* Under-fill: keep the belly from falling into the grid. */}
      <directionalLight
        position={[0.3, -1.6, 2.4]}
        intensity={0.46}
        color="#9aabbe"
      />
      {/* Section cut only. Quieter than the full rig dump. */}
      <directionalLight
        ref={bindCutLight}
        position={[-2.4, 3.6, 2.6]}
        intensity={0.4}
        color="#f4f7fb"
      />
      <directionalLight
        ref={bindCutLight}
        position={[-2.8, 0.2, 4.4]}
        intensity={0.15}
        color="#e8eef6"
      />
      {environment ? (
        <Environment resolution={256} environmentIntensity={0.34}>
          <Lightformer
            intensity={3.2}
            rotation-x={Math.PI / 2}
            position={[0, 5, 0]}
            scale={[8, 8, 1]}
            color="#d8e4f2"
          />
          <Lightformer
            intensity={1.6}
            position={[-4, 2.4, 2]}
            scale={[3, 5, 1]}
            color="#f5f8fc"
          />
          <Lightformer
            intensity={1.1}
            position={[4.5, 1.6, -1]}
            scale={[2.5, 4, 1]}
            color="#60a5fa"
          />
        </Environment>
      ) : null}
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
  shadows: boolean;
  bob: boolean;
  portrait: boolean;
};

function Rocket({
  poseRef,
  view,
  sectionRef,
  shadows,
  bob,
  portrait,
}: RocketProps) {
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
  const floatRef = useRef<Group>(null);

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

  useEffect(() => {
    invalidate();
  }, [invalidate, portrait]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group || height === 0) return;
    const { lift, tilt, spin, explode } = poseRef.current;
    group.scale.setScalar(
      (view === 'exhibit'
        ? exhibitRocketLength(viewport.width, viewport.height, portrait)
        : flybyRocketLength(viewport.width, viewport.height, tilt)) / height,
    );
    const restY = -viewport.height * NOSE_TIP;
    if (view === 'exhibit') {
      if (!EXHIBIT_STANDS && bob) {
        const phase =
          (performance.now() / 1000 / EXHIBIT_FLOAT_PERIOD) * Math.PI * 2;
        exhibitFloat.y = Math.sin(phase) * EXHIBIT_FLOAT_AMP;
        exhibitFloat.pitch = Math.cos(phase) * EXHIBIT_FLOAT_PITCH;
      } else {
        exhibitFloat.y = 0;
        exhibitFloat.pitch = 0;
      }
      const offset = exhibitRocketOffset(portrait);
      group.position.x = viewport.width * offset.x;
      group.position.y = viewport.height * offset.y;
      if (floatRef.current) {
        floatRef.current.rotation.z = exhibitFloat.pitch;
      }
    } else {
      group.position.x = 0;
      group.position.y = restY * (1 - lift);
    }
    if (tiltRef.current) {
      tiltRef.current.rotation.z =
        view === 'exhibit' ? tilt + exhibitRocketTilt(portrait) : tilt;
    }
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
      if (shadows) {
        setShadowOpacity(hullShadowRef.current, SHADOW_OPACITY * (1 - cut));
        setShadowOpacity(cutShadowRef.current, SHADOW_OPACITY * cut);
      }
    }
  });

  if (height === 0) return null;

  return (
    <group ref={groupRef}>
      <group ref={floatRef}>
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
      </group>
      {view === 'exhibit' && EXHIBIT_STANDS ? (
        <RocketStands length={height} />
      ) : null}
      {view === 'exhibit' && shadows ? (
        <>
          <ExhibitShadow shadowRef={hullShadowRef} layer={EXHIBIT_LAYER_HULL} />
          <ExhibitShadow shadowRef={cutShadowRef} layer={EXHIBIT_LAYER_CUT} />
        </>
      ) : null}
    </group>
  );
}

type InvalidateBridgeProps = {
  running: boolean;
};

function InvalidateBridge({ running }: InvalidateBridgeProps) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => registerRocketInvalidate(invalidate), [invalidate]);
  useEffect(() => {
    if (running) invalidate();
  }, [running, invalidate]);
  return null;
}

type RocketSceneProps = {
  poseRef: RefObject<RocketPose>;
  view?: RocketView;
  sectionRef?: RefObject<SectionState>;
  tier: QualityTier;
  running?: boolean;
  portrait?: boolean;
};

export function RocketScene({
  poseRef,
  view = 'flyby',
  sectionRef,
  tier,
  running = true,
  portrait = false,
}: RocketSceneProps) {
  const cutRef = sectionRef ?? { current: REST_SECTION };
  const budget = qualityBudget(tier);
  const [glAttributes] = useState(() => ({
    antialias: budget.antialias,
    alpha: true,
    preserveDrawingBuffer:
      ROCKET_PORTAL && (view === 'flyby' ? budget.dissolve : budget.exhibitFx),
  }));
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry?.isIntersecting ?? true);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const live = running && inView;

  return (
    <div ref={hostRef} className="h-full w-full">
      <Canvas
        className="h-full w-full"
        style={{ pointerEvents: 'none' }}
        frameloop={live ? budget.frameloop : 'never'}
        dpr={budget.dpr}
        gl={glAttributes}
        camera={{ fov: FOV, position: [0, 0, CAMERA_DISTANCE] }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = view === 'exhibit' ? 1.0 : 1.2;
          camera.layers.enable(EXHIBIT_LAYER_HULL);
          camera.layers.enable(EXHIBIT_LAYER_CUT);
        }}
      >
        <InvalidateBridge running={live} />
        {view === 'exhibit' ? (
          <ExhibitRig environment={budget.environment} />
        ) : (
          <FlybyLights />
        )}
        <Suspense fallback={null}>
          <Rocket
            poseRef={poseRef}
            view={view}
            sectionRef={cutRef}
            shadows={EXHIBIT_SHADOWS && budget.shadows}
            bob={budget.frameloop === 'always'}
            portrait={view === 'exhibit' && portrait}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
