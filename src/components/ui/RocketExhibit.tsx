import { useRef } from 'react';

import { HeroRocket } from '@/components/ui/HeroRocket';
import { EXHIBIT_ROCKET_POSE } from '@/lib/rocket';

type RocketExhibitProps = {
  name: string;
};

/**
 * Incoming side of the portal: assembled rocket, horizontal, name underneath.
 * Hidden until the dissolve hole opens; GSAP owns visibility.
 */
export function RocketExhibit({ name }: RocketExhibitProps) {
  const poseRef = useRef({ ...EXHIBIT_ROCKET_POSE });

  return (
    <div className="rocket-exhibit" aria-hidden="true">
      <div className="rocket-exhibit-stage">
        <HeroRocket poseRef={poseRef} />
      </div>
      <p className="rocket-exhibit-name">{name}</p>
    </div>
  );
}
