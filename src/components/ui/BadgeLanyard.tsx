// Source: https://reactbits.dev/components/lanyard  Adapted: 2026-09-07
//
// Rapier rope + spherical card joint, unchanged from upstream: three rope
// joints of length 1 hang off a fixed anchor, and the card swings from the
// last one. Camera sits closer than the documented 26 so the badge fills
// the contact column instead of floating in empty canvas; ContactBadge
// scales that distance with the canvas so the framing survives.
//
// Upstream drags inside a column-sized canvas, which drops the card as soon
// as the cursor leaves it. Here the canvas covers the viewport and passes
// the pointer through, and the contact section feeds it events, so the card
// can be thrown anywhere on screen while the page stays clickable.
//
// Both card faces are printed into the atlas by scripts/build-badge-model.mjs,
// so there is no runtime compositing. That script must not quantize the mesh:
// upstream mounts `nodes.card.geometry` without its node transform, and
// quantization parks the dequant scale on the node.

import { Environment, Lightformer, useGLTF, useTexture } from '@react-three/drei';
import {
  Canvas,
  extend,
  useFrame,
  type ThreeElement,
  type ThreeEvent,
} from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
  type RigidBodyProps,
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  CatmullRomCurve3,
  Color,
  Mesh,
  RepeatWrapping,
  Vector2,
  Vector3,
  type MeshStandardMaterial,
} from 'three';

import badgeUrl from '@/assets/generated/badge-card.glb?url';
import strapUrl from '@/assets/images/badge-strap.png?url';

extend({ MeshLineGeometry, MeshLineMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    meshLineGeometry: ThreeElement<typeof MeshLineGeometry>;
    meshLineMaterial: ThreeElement<typeof MeshLineMaterial>;
  }
}

const SEGMENT: RigidBodyProps = {
  type: 'dynamic',
  canSleep: true,
  colliders: false,
  angularDamping: 4,
  linearDamping: 4,
};

type BadgeLanyardProps = {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  /** Frozen while the section is off screen so nothing burns frames. */
  running?: boolean;
  lanyardImage?: string | null;
  lanyardWidth?: number;
  /** Ancestor the scene listens on, since the canvas ignores the pointer. */
  pointerSource?: RefObject<HTMLElement>;
  onHoverChange?: (hovered: boolean) => void;
};

export function BadgeLanyard({
  position = [0, 0, 11],
  gravity = [0, -40, 0],
  fov = 20,
  running = true,
  lanyardImage = null,
  lanyardWidth = 1,
  pointerSource,
  onHoverChange,
}: BadgeLanyardProps) {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <Canvas
      className="badge-lanyard-canvas"
      camera={{ position, fov }}
      // The canvas covers the viewport now, so the badge is paid for in far
      // more pixels than it used to be; density gives way before frames do.
      dpr={[1, compact ? 1.25 : 1.75]}
      frameloop={running ? 'always' : 'never'}
      eventSource={pointerSource}
      gl={{ alpha: true }}
      onCreated={(state) => {
        state.gl.setClearColor(new Color(0x000000), 0);
        // Events arrive from the section, so the default offsetX/offsetY is
        // measured against whichever element the pointer happens to be over.
        // Re-base on the canvas rect, which stays right off the canvas too.
        state.setEvents({
          compute(event, root) {
            const rect = root.gl.domElement.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            root.pointer.set(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1,
            );
            root.raycaster.setFromCamera(root.pointer, root.camera);
          },
        });
      }}
    >
      <ambientLight intensity={Math.PI} />
      <Suspense fallback={null}>
        <Physics
          gravity={gravity}
          paused={!running}
          timeStep={compact ? 1 / 30 : 1 / 60}
        >
          <Band
            compact={compact}
            lanyardImage={lanyardImage}
            lanyardWidth={lanyardWidth}
            onHoverChange={onHoverChange}
          />
        </Physics>
      </Suspense>
      <Environment blur={0.75}>
        <Lightformer
          intensity={2}
          color="white"
          position={[0, -1, 5]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={3}
          color="white"
          position={[-1, -1, 1]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={3}
          color="white"
          position={[1, 1, 1]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={10}
          color="white"
          position={[-10, 0, 14]}
          rotation={[0, Math.PI / 2, Math.PI / 3]}
          scale={[100, 10, 1]}
        />
      </Environment>
    </Canvas>
  );
}

type BandProps = {
  maxSpeed?: number;
  minSpeed?: number;
  compact: boolean;
  lanyardImage?: string | null;
  lanyardWidth?: number;
  onHoverChange?: (hovered: boolean) => void;
};

type LanyardBody = RapierRigidBody & {
  lerped?: Vector3;
};

function Band({
  maxSpeed = 50,
  minSpeed = 0,
  compact,
  lanyardImage = null,
  lanyardWidth = 1,
  onHoverChange,
}: BandProps) {
  const band = useRef<
    Mesh<
      InstanceType<typeof MeshLineGeometry>,
      InstanceType<typeof MeshLineMaterial>
    >
  >(null);
  const fixed = useRef<RapierRigidBody>(null!);
  const j1 = useRef<LanyardBody>(null!);
  const j2 = useRef<LanyardBody>(null!);
  const j3 = useRef<RapierRigidBody>(null!);
  const card = useRef<RapierRigidBody>(null!);
  const scratch = useRef({
    vec: new Vector3(),
    ang: new Vector3(),
    rot: new Vector3(),
    dir: new Vector3(),
  }).current;

  // Neither Draco nor Meshopt: the build script leaves the geometry plain so
  // the node transforms stay identity.
  const { nodes, materials } = useGLTF(badgeUrl, false, false);
  const strap = useTexture(lanyardImage ?? strapUrl);

  const cardMesh = asMesh(nodes.card, 'card');
  const clipMesh = asMesh(nodes.clip, 'clip');
  const clampMesh = asMesh(nodes.clamp, 'clamp');
  const baseMaterial = asStandard(materials.base, 'base');
  const metalMaterial = asStandard(materials.metal, 'metal');

  const strapMap = useMemo(() => {
    const texture = strap.clone();
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }, [strap]);

  // MeshLineMaterial takes its resolution through the constructor, so this has
  // to stay referentially stable or R3F rebuilds the band every render.
  const strapMaterial = useMemo(
    () => [{ resolution: new Vector2(1000, compact ? 2000 : 1000) }] as const,
    [compact],
  );

  const curve = useRef(
    new CatmullRomCurve3(
      [new Vector3(), new Vector3(), new Vector3(), new Vector3()],
      false,
      'chordal',
    ),
  ).current;
  const [dragged, drag] = useState<false | Vector3>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.45, 0],
  ]);

  useEffect(() => {
    onHoverChange?.(hovered);
  }, [hovered, onHoverChange]);

  // The grip belongs to the card, not to the canvas around it, and it has to
  // survive a drag crossing text fields and links, so it rides on <html>.
  useEffect(() => {
    if (!hovered && !dragged) return;
    const root = document.documentElement;
    root.dataset.badgeGrip = dragged ? 'grabbing' : 'grab';
    return () => {
      delete root.dataset.badgeGrip;
    };
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    const { vec, ang, rot, dir } = scratch;

    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      for (const ref of [card, j1, j2, j3, fixed]) ref.current?.wakeUp();
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }

    if (!fixed.current || !j1.current || !j2.current) return;
    if (!j3.current || !card.current) return;

    // Catmull-Rom through the raw joint positions jitters, so the two middle
    // control points chase their bodies instead of snapping to them.
    for (const joint of [j1.current, j2.current]) {
      const lerped = getLerped(joint);
      const gap = Math.max(
        0.1,
        Math.min(1, lerped.distanceTo(joint.translation())),
      );
      lerped.lerp(
        joint.translation(),
        delta * (minSpeed + gap * (maxSpeed - minSpeed)),
      );
    }

    curve.points[0]?.copy(j3.current.translation());
    curve.points[1]?.copy(getLerped(j2.current));
    curve.points[2]?.copy(getLerped(j1.current));
    curve.points[3]?.copy(fixed.current.translation());
    band.current?.geometry.setPoints(curve.getPoints(compact ? 16 : 32));

    // Bleed off spin so the card settles face-on rather than twirling.
    ang.copy(card.current.angvel());
    rot.copy(card.current.rotation());
    card.current.setAngvel(
      { x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z },
      true,
    );
  });

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...SEGMENT} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...SEGMENT}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...SEGMENT}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...SEGMENT}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...SEGMENT}
          type={dragged ? 'kinematicPosition' : 'dynamic'}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(event: ThreeEvent<PointerEvent>) => {
              grip(event).releasePointerCapture(event.pointerId);
              drag(false);
            }}
            onPointerCancel={() => drag(false)}
            onPointerDown={(event: ThreeEvent<PointerEvent>) => {
              const body = card.current;
              if (!body) return;
              grip(event).setPointerCapture(event.pointerId);
              drag(
                new Vector3()
                  .copy(event.point)
                  .sub(scratch.vec.copy(body.translation())),
              );
            }}
          >
            <mesh geometry={cardMesh.geometry}>
              <meshPhysicalMaterial
                map={baseMaterial.map}
                map-anisotropy={16}
                clearcoat={compact ? 0 : 1}
                clearcoatRoughness={0.15}
                roughness={0.9}
                metalness={0.8}
              />
            </mesh>
            <mesh
              geometry={clipMesh.geometry}
              material={metalMaterial}
              material-roughness={0.3}
            />
            <mesh geometry={clampMesh.geometry} material={metalMaterial} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          args={strapMaterial}
          color="white"
          depthTest={false}
          useMap={1}
          map={strapMap}
          repeat={[-4, 1]}
          lineWidth={lanyardWidth}
        />
      </mesh>
    </>
  );
}

type PointerCapture = {
  setPointerCapture: (id: number) => void;
  releasePointerCapture: (id: number) => void;
};

/**
 * R3F swaps `target` for a capture shim it never reflects in the DOM event
 * type the handler inherits. Capturing through it hands the pointer to the
 * canvas, so the card keeps the grip once the cursor leaves it.
 */
function grip(event: ThreeEvent<PointerEvent>): PointerCapture {
  return event.target as unknown as PointerCapture;
}

function getLerped(body: LanyardBody): Vector3 {
  body.lerped ??= new Vector3().copy(body.translation());
  return body.lerped;
}

function asMesh(object: unknown, name: string): Mesh {
  if (object instanceof Mesh) return object;
  throw new Error(`Badge model is missing mesh "${name}"`);
}

function asStandard(material: unknown, name: string): MeshStandardMaterial {
  if (material && typeof material === 'object' && 'isMaterial' in material) {
    return material as MeshStandardMaterial;
  }
  throw new Error(`Badge model is missing material "${name}"`);
}

useGLTF.preload(badgeUrl, false, false);
