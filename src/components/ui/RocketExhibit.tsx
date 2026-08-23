import gsap from 'gsap';
import { BookOpen, SatelliteDish, Scan } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import sceneUrl from '@/assets/images/exhibit-scene-chute-h.png?url';
import { ExhibitFx } from '@/components/ui/ExhibitFx';
import { HeroRocket } from '@/components/ui/HeroRocket';
import { SpecularButton } from '@/components/ui/SpecularButton';
import { EXHIBIT_ROCKET_POSE, REST_SECTION } from '@/lib/rocket';
import { cn } from '@/lib/utils';

type RocketExhibitProps = {
  name: string;
  work: string;
  sectionLabel: string;
  missionLabel: string;
  groundLabel: string;
  fxLabel: string;
  fx: boolean;
};

type ExhibitHudButtonProps = {
  className?: string;
  label: string;
  pressed?: boolean;
  onClick?: () => void;
  icon: ReactNode;
};

function ExhibitHudButton({
  className = '',
  label,
  pressed,
  onClick,
  icon,
}: ExhibitHudButtonProps) {
  return (
    <SpecularButton
      className={cn('rocket-exhibit-hud-btn', className)}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {icon}
      <span className="rocket-exhibit-hud-label">{label}</span>
    </SpecularButton>
  );
}

/**
 * Incoming side of the portal: assembled rocket, horizontal, name underneath.
 * Hidden until the dissolve hole opens; GSAP owns visibility.
 */
export function RocketExhibit({
  name,
  work,
  sectionLabel,
  missionLabel,
  groundLabel,
  fxLabel,
  fx,
}: RocketExhibitProps) {
  const poseRef = useRef({ ...EXHIBIT_ROCKET_POSE });
  const sectionRef = useRef({ ...REST_SECTION });
  const [cutOpen, setCutOpen] = useState(false);

  useEffect(
    () => () => {
      gsap.killTweensOf(sectionRef.current);
    },
    [],
  );

  const toggleCut = () => {
    const next = !cutOpen;
    setCutOpen(next);
    gsap.to(sectionRef.current, {
      cut: next ? 1 : 0,
      duration: 0.4,
      ease: 'power2.inOut',
    });
  };

  return (
    <div className="rocket-exhibit" role="region" aria-label={fxLabel}>
      <div className="rocket-exhibit-space" aria-hidden="true">
        <img src={sceneUrl} alt="" className="rocket-exhibit-scene" />
      </div>
      <div className="rocket-exhibit-stage" aria-hidden="true">
        <HeroRocket poseRef={poseRef} view="exhibit" sectionRef={sectionRef} />
      </div>
      {fx && !cutOpen ? <ExhibitFx /> : null}
      <h2 className="rocket-exhibit-work">
        <span>{work}</span>
      </h2>
      <div className="rocket-exhibit-hud">
        <div className="rocket-exhibit-rail rocket-exhibit-rail--left">
          <ExhibitHudButton
            label={missionLabel}
            icon={
              <BookOpen
                aria-hidden="true"
                className="rocket-exhibit-hud-icon"
              />
            }
          />
        </div>
        <div className="rocket-exhibit-caption">
          <p className="rocket-exhibit-name">{name}</p>
          <ExhibitHudButton
            className="rocket-exhibit-cut"
            label={sectionLabel}
            pressed={cutOpen}
            onClick={toggleCut}
            icon={
              <Scan aria-hidden="true" className="rocket-exhibit-hud-icon" />
            }
          />
        </div>
        <div className="rocket-exhibit-rail rocket-exhibit-rail--right">
          <ExhibitHudButton
            label={groundLabel}
            icon={
              <SatelliteDish
                aria-hidden="true"
                className="rocket-exhibit-hud-icon"
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
