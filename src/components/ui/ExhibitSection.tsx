import { useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Group } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import sectionUrl from '@/assets/generated/rocket-section.glb?url';
import {
  EXHIBIT_LAYER_CUT,
  type RocketView,
  type SectionState,
} from '@/lib/rocket';
import { clonePaintedMaterials, setCutOpacity } from '@/lib/rocket-paint';

function withMeshopt(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

type ExhibitSectionProps = {
  view: RocketView;
  sectionRef: RefObject<SectionState>;
};

export function ExhibitSection({ view, sectionRef }: ExhibitSectionProps) {
  const gltf = useLoader(GLTFLoader, sectionUrl, withMeshopt);
  const groupRef = useRef<Group>(null);

  const { model, materials } = useMemo(() => {
    const model = gltf.scene.clone(true);
    const materials = clonePaintedMaterials(model, view);
    model.traverse((child) => {
      child.layers.set(EXHIBIT_LAYER_CUT);
    });
    return { model, materials };
  }, [gltf, view]);

  useEffect(() => {
    return () => {
      for (const material of materials) material.dispose();
    };
  }, [materials]);

  useFrame(() => {
    const cut = sectionRef.current.cut;
    const group = groupRef.current;
    if (!group) return;
    group.visible = cut > 0.001;
    setCutOpacity(materials, cut, cut >= 0.5);
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={model} />
    </group>
  );
}
