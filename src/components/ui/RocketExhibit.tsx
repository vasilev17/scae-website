import { useRef } from 'react';

import sceneUrl from '@/assets/images/exhibit-scene-chute-h.png?url';
import { ExhibitFx } from '@/components/ui/ExhibitFx';
import { HeroRocket } from '@/components/ui/HeroRocket';
import { EXHIBIT_ROCKET_POSE } from '@/lib/rocket';

type RocketExhibitProps = {
  name: string;
  work: string;
  fxLabel: string;
  fx: boolean;
};

/**
 * Incoming side of the portal: assembled rocket, horizontal, name underneath.
 * Hidden until the dissolve hole opens; GSAP owns visibility.
 */
export function RocketExhibit({
  name,
  work,
  fxLabel,
  fx,
}: RocketExhibitProps) {
  const poseRef = useRef({ ...EXHIBIT_ROCKET_POSE });

  return (
    <div className="rocket-exhibit" role="region" aria-label={fxLabel}>
      <div className="rocket-exhibit-space" aria-hidden="true">
        <img src={sceneUrl} alt="" className="rocket-exhibit-scene" />
      </div>
      <div className="rocket-exhibit-stage" aria-hidden="true">
        <HeroRocket poseRef={poseRef} view="exhibit" />
      </div>
      {fx ? <ExhibitFx /> : null}
      <h2 className="rocket-exhibit-work">
        <span>{work}</span>
      </h2>
      <p className="rocket-exhibit-name">{name}</p>
    </div>
  );
}
