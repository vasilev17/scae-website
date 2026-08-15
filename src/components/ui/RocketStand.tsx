import { useEffect, useMemo } from 'react';
import { ExtrudeGeometry, MeshStandardMaterial, Shape } from 'three';

// Model metres. Tube radius is 0.055; cradle is a hair larger so the airframe
// sits in the notch instead of intersecting the plate.
const RADIUS = 0.0565;
const WIDTH = 0.16;
const HEIGHT = 0.24;
const THICKNESS = 0.016;

// Fins end at y = 0.17. Nose shoulder is at y = 0.965.
const AFT_Y = 0.32;
const FWD_Y = 0.88;

function cradleShape(): Shape {
  const shape = new Shape();
  const half = WIDTH / 2;
  shape.moveTo(-half, -HEIGHT);
  shape.lineTo(half, -HEIGHT);
  shape.lineTo(half, 0);
  shape.lineTo(RADIUS, 0);
  shape.absarc(0, 0, RADIUS, 0, Math.PI, true);
  shape.lineTo(-half, 0);
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
      bevelEnabled: false,
      steps: 1,
    });
    next.translate(0, 0, -THICKNESS / 2);
    // Plate faces along the airframe. Side view reads a thin rectangle.
    next.rotateY(Math.PI / 2);
    next.computeVertexNormals();
    return next;
  }, []);

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#ddd6c8',
        roughness: 0.74,
        metalness: 0,
        flatShading: true,
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
      <mesh geometry={geometry} material={material} position={[aft, 0, 0]} />
      <mesh geometry={geometry} material={material} position={[fwd, 0, 0]} />
    </>
  );
}
