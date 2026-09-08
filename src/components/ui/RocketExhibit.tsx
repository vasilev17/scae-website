import gsap from 'gsap';
import { BookOpen, SatelliteDish, Scan } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { BackgroundRippleEffect } from '@/components/ui/BackgroundRippleEffect';
import { ExhibitFx } from '@/components/ui/ExhibitFx';
import { FlickeringGrid } from '@/components/ui/FlickeringGrid';
import { HeroRocket } from '@/components/ui/HeroRocket';
import {
  MissionConceptOverlay,
  type MissionConceptCopy,
} from '@/components/ui/MissionConceptOverlay';
import {
  GroundSegmentOverlay,
  type GroundSegmentCopy,
  type GroundSegmentPhoto,
} from '@/components/ui/GroundSegmentOverlay';
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
  missionCopy: MissionConceptCopy;
  groundLabel: string;
  groundCopy: GroundSegmentCopy;
  groundPhotos: GroundSegmentPhoto[];
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
  expanded?: boolean;
  controls?: string;
  haspopup?: 'dialog';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  icon: ReactNode;
};

function ExhibitHudButton({
  className = '',
  label,
  pressed,
  expanded,
  controls,
  haspopup,
  onClick,
  icon,
}: ExhibitHudButtonProps) {
  return (
    <SpecularButton
      className={cn('rocket-exhibit-hud-btn', className)}
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-haspopup={haspopup}
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
  missionCopy,
  groundLabel,
  groundCopy,
  groundPhotos,
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
  const [missionOpen, setMissionOpen] = useState(false);
  const [missionMounted, setMissionMounted] = useState(false);
  const [missionOrigin, setMissionOrigin] = useState({ x: 0, y: 0 });
  const missionCloseTimer = useRef(0);
  const [groundOpen, setGroundOpen] = useState(false);
  const [groundMounted, setGroundMounted] = useState(false);
  const [groundOrigin, setGroundOrigin] = useState({ x: 0, y: 0 });
  const groundCloseTimer = useRef(0);

  useEffect(
    () => () => {
      gsap.killTweensOf(sectionRef.current);
      window.clearTimeout(missionCloseTimer.current);
      window.clearTimeout(groundCloseTimer.current);
    },
    [],
  );

  const openMission = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    window.clearTimeout(missionCloseTimer.current);
    window.clearTimeout(groundCloseTimer.current);
    setGroundOpen(false);
    setGroundMounted(false);
    setMissionOrigin({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setMissionMounted(true);
    setMissionOpen(true);
  };

  const closeMission = () => {
    setMissionOpen(false);
    window.clearTimeout(missionCloseTimer.current);
    missionCloseTimer.current = window.setTimeout(
      () => setMissionMounted(false),
      580,
    );
  };

  const openGround = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    window.clearTimeout(groundCloseTimer.current);
    window.clearTimeout(missionCloseTimer.current);
    setMissionOpen(false);
    setMissionMounted(false);
    setGroundOrigin({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setGroundMounted(true);
    setGroundOpen(true);
  };

  const closeGround = () => {
    setGroundOpen(false);
    window.clearTimeout(groundCloseTimer.current);
    groundCloseTimer.current = window.setTimeout(
      () => setGroundMounted(false),
      580,
    );
  };

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
            expanded={missionOpen}
            controls="mission-concept-dialog"
            haspopup="dialog"
            onClick={openMission}
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
            expanded={groundOpen}
            controls="ground-segment-dialog"
            haspopup="dialog"
            onClick={openGround}
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
      {missionMounted ? (
        <MissionConceptOverlay
          open={missionOpen}
          origin={missionOrigin}
          title={missionLabel}
          copy={missionCopy}
          onClose={closeMission}
        />
      ) : null}
      {groundMounted ? (
        <GroundSegmentOverlay
          open={groundOpen}
          origin={groundOrigin}
          title={groundLabel}
          copy={groundCopy}
          photos={groundPhotos}
          onClose={closeGround}
        />
      ) : null}
    </div>
  );
}
