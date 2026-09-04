import gsap from 'gsap';
import { BookOpen, SatelliteDish, Scan } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { BackgroundRippleEffect } from '@/components/ui/BackgroundRippleEffect';
import { ExhibitFx } from '@/components/ui/ExhibitFx';
import { FlickeringGrid } from '@/components/ui/FlickeringGrid';
import { HeroRocket } from '@/components/ui/HeroRocket';
import { SpecularButton } from '@/components/ui/SpecularButton';
import { Spotlight } from '@/components/ui/Spotlight';
import {
  PartnersMarquee,
  type PartnerLogo,
} from '@/components/ui/PartnersMarquee';
import { Starfield } from '@/components/ui/Starfield';
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
  partnersTitle: string;
  partnersAria: string;
  partnerLogos: PartnerLogo[];
  aboutTitle: string;
  aboutBody: string;
  aboutPhotoSrc: string;
  aboutPhotoAlt: string;
  aboutPhotoWidth: number;
  aboutPhotoHeight: number;
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
  partnersTitle,
  partnersAria,
  partnerLogos,
  aboutTitle,
  aboutBody,
  aboutPhotoSrc,
  aboutPhotoAlt,
  aboutPhotoWidth,
  aboutPhotoHeight,
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
      <BackgroundRippleEffect cellSize={64} />
      <div className="rocket-exhibit-spotlights" aria-hidden="true">
        <Spotlight
          className="-top-24 left-[12%] md:-top-4 md:left-[20%]"
          fill="var(--color-flag-white)"
          filterId="exhibit-spotlight-key"
        />
        <div className="rocket-exhibit-spotlight-mirror">
          <Spotlight
            className="-top-36 left-[18%] md:-top-12 md:left-[26%]"
            fill="var(--color-accent)"
            filterId="exhibit-spotlight-fill"
          />
        </div>
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
          <div className="rocket-exhibit-cut-slot">
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
      <div className="rocket-exhibit-veil" aria-hidden="true" />
      <div className="void-stars" aria-hidden="true">
        {/* Always mounted so the canvas can size before the fade. Sealed off
            from warp: this field ignores scroll, pointer and frame rate. */}
        <Starfield
          bgColor="rgba(0, 0, 0, 1)"
          starColor="rgba(255, 255, 255, 1)"
          speed={0.9}
          quantity={320}
          warpReactive={false}
        />
      </div>
      <div className="void-content">
        <div className="void-backglow" aria-hidden="true" />
        <div className="void-panel" data-flicker-host>
          <div className="void-panel-grid" aria-hidden="true">
            <FlickeringGrid
              squareSize={3}
              gridGap={10}
              maxOpacity={0.2}
              flickerChance={0.16}
              majorEvery={7}
              interactive
            />
          </div>
          <div className="void-panel-backlight" aria-hidden="true" />
          <div className="void-panel-body">
            <h2 className="void-partners-title">
              <span>{partnersTitle}</span>
            </h2>
            <PartnersMarquee ariaLabel={partnersAria} logos={partnerLogos} />
            <section
              className="void-about"
              id="about"
              aria-labelledby="void-about-title"
            >
              <div className="void-about-media">
                <img
                  src={aboutPhotoSrc}
                  alt={aboutPhotoAlt}
                  width={aboutPhotoWidth}
                  height={aboutPhotoHeight}
                />
                <span className="void-about-media-scan" aria-hidden="true" />
              </div>
              <div className="void-about-copy">
                <h3 className="void-about-title" id="void-about-title">
                  <span>{aboutTitle}</span>
                </h3>
                <p className="void-about-body">{aboutBody}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
