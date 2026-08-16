import { useEffect, useMemo } from 'react';
import { ExtrudeGeometry, MeshStandardMaterial, Shape } from 'three';

// Model metres. Tube radius is 0.055. Plate is a tall narrow trapezoid:
// U-notch to the centreline, taper to a wider base.
const RADIUS = 0.0565;
const TOP_HALF = 0.062;
const BASE_HALF = 0.095;
export const STAND_HEIGHT = 0.145;
const THICKNESS = 0.018;

// Fins end at y = 0.17. Nose shoulder is at y = 0.965.
// Left/right along the airframe (screen X after exhibit pose).
const AFT_Y = 0.325;
const FWD_Y = 0.92;
// Up/down in model metres. +Y = up.
const STAND_LIFT = 0;
// Pitch around world X, radians. + = tip toward camera.
const STAND_TILT_X = 0.15;

function cradleShape(): Shape {
  const shape = new Shape();
  shape.moveTo(-BASE_HALF, -STAND_HEIGHT);
  shape.lineTo(BASE_HALF, -STAND_HEIGHT);
  shape.lineTo(TOP_HALF, 0);
  shape.lineTo(RADIUS, 0);
  shape.absarc(0, 0, RADIUS, 0, Math.PI, true);
  shape.lineTo(-TOP_HALF, 0);
  shape.closePath();
  return shape;
}

type RocketStandsProps = {
  length: number;
};

export function RocketStands({ length }: RocketStandsProps) {
  const geometry = useMemo(() => {
    const next = new ExtrudeGeometry(cradleShape(), {
      depth: THICKNESS,
      bevelEnabled: true,
      bevelThickness: 0.0015,
      bevelSize: 0.0015,
      bevelSegments: 1,
      steps: 1,
    });
    next.translate(0, 0, -THICKNESS / 2);
    // Plate cuts across the tube. Thin along the airframe, U in the end-on plane.
    next.rotateY(Math.PI / 2);
    next.computeVertexNormals();
    return next;
  }, []);

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#c8c4ba',
        roughness: 0.88,
        metalness: 0,
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const aft = AFT_Y - length / 2;
  const fwd = FWD_Y - length / 2;

  return (
    <>
      <mesh
        geometry={geometry}
        material={material}
        position={[aft, STAND_LIFT, 0]}
        rotation={[STAND_TILT_X, 0, 0]}
      />
      <mesh
        geometry={geometry}
        material={material}
        position={[fwd, STAND_LIFT, 0]}
        rotation={[STAND_TILT_X, 0, 0]}
      />
    </>
  );
}
