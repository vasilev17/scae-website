import { useRef } from 'react';

import { ExhibitFx } from '@/components/ui/ExhibitFx';
import { HeroRocket } from '@/components/ui/HeroRocket';
import { Starfield } from '@/components/ui/Starfield';
import { EXHIBIT_ROCKET_POSE } from '@/lib/rocket';

type RocketExhibitProps = {
  name: string;
  fxLabel: string;
  fx: boolean;
};

/**
 * Incoming side of the portal: assembled rocket, horizontal, name underneath.
 * Hidden until the dissolve hole opens; GSAP owns visibility.
 */
export function RocketExhibit({ name, fxLabel, fx }: RocketExhibitProps) {
  const poseRef = useRef({ ...EXHIBIT_ROCKET_POSE });

  return (
    <div className="rocket-exhibit" role="region" aria-label={fxLabel}>
      <div className="rocket-exhibit-space" aria-hidden="true">
        <Starfield
          bgColor="rgba(0, 0, 0, 1)"
          starColor="rgba(255, 255, 255, 1)"
          speed={0.75}
          quantity={400}
        />
      </div>
      <div className="rocket-exhibit-stage" aria-hidden="true">
        <HeroRocket poseRef={poseRef} view="exhibit" />
      </div>
      {fx ? <ExhibitFx /> : null}
      <p className="rocket-exhibit-name">{name}</p>
    </div>
  );
}
