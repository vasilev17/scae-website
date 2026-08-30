import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef, useState } from 'react';

import {
  CircularMenu,
  type CircularMenuItem,
} from '@/components/ui/CircularMenu';
import { DissolveOverlay } from '@/components/ui/DissolveOverlay';
import { GateFrame } from '@/components/ui/GateFrame';
import { GateNav } from '@/components/ui/GateNav';
import { HeroRocket } from '@/components/ui/HeroRocket';
import { RocketExhibit } from '@/components/ui/RocketExhibit';
import { SeeMoreCue } from '@/components/ui/SeeMoreCue';
import { Starfield, type StarfieldWarp } from '@/components/ui/Starfield';
import {
  GATE_CRACK_TRAVEL,
  GATE_INTERIOR_DELAY,
  GATE_PHASES,
  gateFlybyOrigin,
  perGatePane,
  readGateGeometry,
} from '@/lib/gate';
import {
  REST_ROCKET_POSE,
  ROCKET_FLY_SPIN,
  ROCKET_FLY_TILT,
  type RocketPose,
} from '@/lib/rocket';
import { ROCKET_DISASSEMBLE } from '@/lib/rocket-disassemble';
import { REST_PORTAL, ROCKET_PORTAL } from '@/lib/rocket-portal';
import {
  getSmoothScroll,
  startInternalRaf,
  stopInternalRaf,
} from '@/lib/smooth-scroll';

gsap.registerPlugin(useGSAP, ScrollTrigger);

type LandingHeroProps = {
  metalSrc: string;
  logoSrc: string;
  contactIconSrc: string;
  menuIconSrc: string;
  // Accessible name for the hero region.
  label: string;
  headline: string;
  subtitle: string;
  seeMore: string;
  exhibitName: string;
  exhibitWork: string;
  exhibitSection: string;
  exhibitMission: string;
  exhibitGround: string;
  exhibitFxLabel: string;
  nav: {
    label: string;
    brand: string;
    contact: string;
    menu: string;
  };
  menu: {
    label: string;
    close: string;
    items: CircularMenuItem[];
  };
  // Length of the gate's opening animation (in seconds).
  introDuration?: number;
};

/**
 * How much the pane pair grows while the camera pushes through the gap.
 * Sized so the inner edges just clear the viewport at the end of the pin,
 * instead of overshooting and vanishing mid-scroll.
 */
const FLYBY_SCALE = 2.4;

// Copy sits behind the frame. Same scroll clock, smaller scale, so it lags
// the panes instead of blowing past them.
const INTERIOR_SCALE = 1.75;

// Warp at the deepest point of the push, then the cruise it eases to.
const WARP = { speed: 8, zoom: 2.2 } as const;
const CRUISE_SPEED = 2;

// Gate / interior zoom. Keep this duration; SCROLL_LENGTH is sized so
// this beat still eats the same viewport distance when the fly pose grows.
const ZOOM_DURATION = 0.7;

// Lift / tilt / roll to the diagonal. Starts near the end of the zoom,
// then runs past it. No extra roll after it parks.
const ROCKET_FLY_START = 0.52;
const ROCKET_FLY_DURATION = 0.4;
const FLY_POSE_END = ROCKET_FLY_START + ROCKET_FLY_DURATION;

const EXPLODE_DURATION = 0.45;
// Timeline units after explode starts. 0 = hole with the first crack.
// Bigger = later hole. 0.12 ≈ parts already a little apart.
const DISSOLVE_DELAY = 0.075;
// Rails start once the hole has begun. Rays wait — their bloom sits at
// the top, still covered if they share the rail lag.
const RAIL_SLIDE_LAG = 0.18;
const RAY_SLIDE_LAG = 0.58;
const RAIL_SLIDE_DURATION = 0.45;

// Pin length: zoom keeps ~146% viewport. Extra tail is the dissolve lag.
const SCROLL_LENGTH = '+=311%';

// Full viewport drop: panes travel off-screen during the open, so parking
// behind the bottom pane is not enough. The GLB still loads in that hole.
const ROCKET_ENTRY = 100;
const ROCKET_ENTRY_DURATION = 1.4;

// How long the gate takes to shut behind the menu, and to reopen after it.
const DOOR_DURATION = 0.9;
// Head start the dial's flicker-out gets before the gate reopens.
const MENU_EXIT = 0.45;

export function LandingHero({
  metalSrc,
  logoSrc,
  contactIconSrc,
  menuIconSrc,
  label,
  headline,
  subtitle,
  seeMore,
  exhibitName,
  exhibitWork,
  exhibitSection,
  exhibitMission,
  exhibitGround,
  exhibitFxLabel,
  nav,
  menu,
  introDuration = 2.6,
}: LandingHeroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const warpRef = useRef<StarfieldWarp>({ speed: 1, zoom: 1 });
  const rocketPose = useRef<RocketPose>({ ...REST_ROCKET_POSE });
  const portal = useRef({ ...REST_PORTAL });
  const [introDone, setIntroDone] = useState(false);
  // Two flags rather than one: the gate leads the dial in and trails it out,
  // and while they disagree a transition is still running.
  const [gateShut, setGateShut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exhibitFx, setExhibitFx] = useState(false);

  /**
   * One frame loop for the page: Lenis moves the scroll and ScrollTrigger reads
   * it in the same tick, so the pinned flyby cannot trail the wheel by a frame.
   */
  useEffect(() => {
    const lenis = getSmoothScroll();
    const drive = (time: number) => lenis.raf(time * 1000);

    stopInternalRaf();
    const unsubscribe = lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(drive);
    // Scrub reacts to scroll deltas, so a frame the tab dropped must not be
    // smoothed away into a jump.
    gsap.ticker.lagSmoothing(0);

    return () => {
      unsubscribe();
      gsap.ticker.remove(drive);
      gsap.ticker.lagSmoothing(500, 33);
      startInternalRaf();
    };
  }, []);

  /**
   * Scrolling during the opening would desync the gate from the scroll
   * choreography that takes over from it, so the page is held until the panes
   * have settled. The shut gate holds it for as long as the menu is up.
   * Readers who opted out of motion are never locked out by the intro.
   */
  useEffect(() => {
    const holdForIntro =
      !introDone &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!holdForIntro && !gateShut) return;

    // A stopped Lenis clips overflow on the root, so wheel, touch, keyboard
    // and scrollbar are all held, not just the smoothed input.
    const lenis = getSmoothScroll();
    lenis.stop();
    if (holdForIntro) lenis.scrollTo(0, { immediate: true, force: true });

    return () => lenis.start();
  }, [introDone, gateShut]);

  const { contextSafe } = useGSAP(
    () => {
      const root = rootRef.current;
      const gate = gateRef.current;
      const hero = heroRef.current;
      if (!root || !gate || !hero) return;

      const geometry = readGateGeometry(gate);
      // Scoped explicitly: matchMedia opens its own context, which would not
      // inherit the scope useGSAP applies to this function.
      const media = gsap.matchMedia(root);

      media.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          animate: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          if (context.conditions?.reduce) {
            gsap.set('.gate-pane-group', {
              yPercent: perGatePane(geometry.restTop, geometry.restBottom),
              willChange: 'auto',
            });
            gsap.set('.gate-logo', { autoAlpha: 0 });
            gsap.set('.gate-nav', { autoAlpha: 1 });
            gsap.set('.see-more', { autoAlpha: 1 });
            gsap.set('.landing-copy', { autoAlpha: 1 });
            gsap.set('.hero-rocket', { yPercent: 0 });
            return;
          }

          gsap.set(rocketPose.current, { ...REST_ROCKET_POSE });
          gsap.set(portal.current, { ...REST_PORTAL });
          gsap.set('.landing-copy', { autoAlpha: 0 });
          gsap.set('.see-more', { autoAlpha: 0 });
          gsap.set('.hero-rocket', { yPercent: ROCKET_ENTRY });

          // Built first so the intro can hand over to it, but held inert until
          // then: a live pin would fight the opening animation.
          const flyby = gsap.timeline({
            scrollTrigger: {
              trigger: hero,
              start: 'top top',
              end: SCROLL_LENGTH,
              pin: true,
              pinSpacing: true,
              scrub: 1,
              onToggle: (self) =>
                gsap.set('.gate-pane-group, .hero-interior', {
                  willChange: self.isActive ? 'transform' : 'auto',
                }),
            },
          });
          flyby.scrollTrigger?.disable();

          gsap.set('.gate-pane-group', {
            transformOrigin: gateFlybyOrigin(geometry),
          });

          flyby
            .to(
              '.gate-pane-group',
              { scale: FLYBY_SCALE, ease: 'none', duration: ZOOM_DURATION },
              0,
            )
            .to(
              '.hero-interior',
              { scale: INTERIOR_SCALE, ease: 'none', duration: ZOOM_DURATION },
              0,
            )
            .to(
              '.hero-interior',
              { autoAlpha: 0, ease: 'none', duration: 0.18 },
              ROCKET_FLY_START,
            )
            .to(
              rocketPose.current,
              {
                lift: 1,
                tilt: ROCKET_FLY_TILT,
                spin: ROCKET_FLY_SPIN,
                explode: 0,
                ease: 'none',
                duration: ROCKET_FLY_DURATION,
              },
              ROCKET_FLY_START,
            )
            .to(
              warpRef.current,
              { ...WARP, ease: 'power2.in', duration: 0.6 },
              0,
            )
            .to(
              warpRef.current,
              { speed: CRUISE_SPEED, ease: 'power2.out', duration: 0.28 },
              ZOOM_DURATION,
            );

          if (ROCKET_DISASSEMBLE) {
            flyby.to(
              rocketPose.current,
              { explode: 1, ease: 'none', duration: EXPLODE_DURATION },
              FLY_POSE_END,
            );
          }

          if (ROCKET_PORTAL) {
            const dissolveAt = FLY_POSE_END + DISSOLVE_DELAY;
            const railsAt = dissolveAt + EXPLODE_DURATION * RAIL_SLIDE_LAG;
            const raysAt = dissolveAt + EXPLODE_DURATION * RAY_SLIDE_LAG;
            const leftRail = '.rocket-exhibit-rail--left';
            const rightRail = '.rocket-exhibit-rail--right';
            const rays = '.rocket-exhibit-ray';
            const rayOff = {
              opacity: 0,
              xPercent: -72,
              yPercent: -62,
              scale: 0.5,
            };
            const rayOn = {
              opacity: 1,
              xPercent: -50,
              yPercent: -40,
              scale: 1,
            };

            flyby.set(
              '.rocket-exhibit, .dissolve-overlay',
              { autoAlpha: 0 },
              0,
            );
            flyby.set(
              '.rocket-exhibit, .dissolve-overlay',
              { autoAlpha: 1 },
              dissolveAt,
            );
            flyby.set(leftRail, { xPercent: 0, x: '-100vw' }, 0);
            flyby.set(rightRail, { xPercent: 0, x: '100vw' }, 0);
            flyby.set(rays, rayOff, 0);
            flyby.fromTo(
              leftRail,
              { xPercent: 0, x: '-100vw' },
              {
                xPercent: 0,
                x: 0,
                ease: 'power2.out',
                duration: RAIL_SLIDE_DURATION,
              },
              railsAt,
            );
            flyby.fromTo(
              rightRail,
              { xPercent: 0, x: '100vw' },
              {
                xPercent: 0,
                x: 0,
                ease: 'power2.out',
                duration: RAIL_SLIDE_DURATION,
              },
              railsAt,
            );
            flyby.fromTo(
              rays,
              rayOff,
              {
                ...rayOn,
                ease: 'power2.out',
                duration: RAIL_SLIDE_DURATION,
                immediateRender: false,
              },
              raysAt,
            );
            flyby.to(
              portal.current,
              { dissolve: 1, ease: 'none', duration: EXPLODE_DURATION },
              dissolveAt,
            );
            flyby.add(() => setExhibitFx(true), dissolveAt);
          }

          // When the panes have parked, plus a beat. Everything the gate was
          // hiding arrives together from here.
          const interiorAt =
            introDuration *
              (GATE_PHASES.settleStart + GATE_PHASES.settleDuration) +
            GATE_INTERIOR_DELAY;

          gsap
            .timeline({
              onComplete: () => {
                setIntroDone(true);
                flyby.scrollTrigger?.enable();
                ScrollTrigger.refresh();
              },
            })
            .to(
              '.gate-pane-group',
              {
                yPercent: perGatePane(-GATE_CRACK_TRAVEL, GATE_CRACK_TRAVEL),
                duration: introDuration * GATE_PHASES.crackDuration,
                ease: 'power4.out',
              },
              introDuration * GATE_PHASES.crackStart,
            )
            .to(
              '.gate-pane-group',
              {
                yPercent: perGatePane(geometry.openTop, geometry.openBottom),
                duration: introDuration * GATE_PHASES.openDuration,
                ease: 'power1.inOut',
              },
              introDuration * GATE_PHASES.openStart,
            )
            // Both swaps happen while the panes are off screen: the split logo
            // goes, the navbar the top pane carries arrives.
            .set(
              '.gate-logo',
              { autoAlpha: 0 },
              introDuration *
                (GATE_PHASES.openStart + GATE_PHASES.openDuration),
            )
            .set(
              '.gate-nav',
              { autoAlpha: 1 },
              introDuration *
                (GATE_PHASES.openStart + GATE_PHASES.openDuration),
            )
            .to(
              '.gate-pane-group',
              {
                yPercent: perGatePane(geometry.restTop, geometry.restBottom),
                duration: introDuration * GATE_PHASES.settleDuration,
                ease: 'power2.out',
              },
              introDuration * GATE_PHASES.settleStart,
            )
            // Interior cues sit in the gap, so they wait until the panes have
            // parked — plus a beat — instead of flashing in while the door is
            // still off-screen.
            .to(
              '.see-more, .landing-copy',
              { autoAlpha: 1, duration: 0.4, ease: 'power2.out' },
              interiorAt,
            )
            // The rocket rises out from behind the bottom pane rather than
            // fading in, so the pane reads as something it is standing behind.
            .to(
              '.hero-rocket',
              {
                yPercent: 0,
                duration: ROCKET_ENTRY_DURATION,
                ease: 'power2.out',
              },
              interiorAt,
            );
        },
      );

      return () => media.revert();
    },
    { scope: rootRef },
  );

  /**
   * Shuts the gate on the way in and reopens it on the way out, with the dial
   * held to the stretch where the panes are still. Ignored mid-transition.
   */
  const runToggle = () => {
    const gate = gateRef.current;
    if (!gate || gateShut !== menuOpen) return;

    const geometry = readGateGeometry(gate);
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const duration = reduce ? 0 : DOOR_DURATION;

    if (!menuOpen) {
      setGateShut(true);
      gsap
        .timeline({ onComplete: () => setMenuOpen(true) })
        // Closed is where the panes started, so the pair simply travels home —
        // any flyby scaling is undone with it.
        .to(
          '.gate-pane-group',
          { yPercent: 0, scale: 1, duration, ease: 'power2.inOut' },
          0,
        )
        .to('.gate-nav', { autoAlpha: 0, duration: duration * 0.3 }, 0);
      return;
    }

    setMenuOpen(false);
    gsap
      .timeline({
        onComplete: () => {
          setGateShut(false);
          menuButtonRef.current?.focus();
        },
      })
      .to(
        '.gate-pane-group',
        {
          yPercent: perGatePane(geometry.restTop, geometry.restBottom),
          duration,
          ease: 'power2.inOut',
        },
        reduce ? 0 : MENU_EXIT,
      )
      .to('.gate-nav', { autoAlpha: 1, duration: duration * 0.3 }, '>-0.35');
  };

  // Wrapped at click time rather than during render: the wrapper reads refs,
  // and the scoping and cleanup it adds are the same either way.
  const toggleMenu = () => contextSafe(runToggle)();

  return (
    <div ref={rootRef}>
      <section
        ref={heroRef}
        className="relative h-dvh w-full overflow-hidden bg-black"
        aria-label={label}
      >
        <Starfield
          bgColor="rgba(0, 0, 0, 1)"
          starColor="rgba(255, 255, 255, 1)"
          speed={0.75}
          quantity={400}
          warpRef={warpRef}
        />
        <div className="hero-interior">
          <div className="landing-copy">
            <h1 className="landing-title">
              <span>{headline}</span>
            </h1>
            <p className="landing-subtitle">{subtitle}</p>
          </div>
          <SeeMoreCue label={seeMore} href="#after-hero" />
        </div>
      </section>
      {ROCKET_PORTAL ? (
        <>
          <RocketExhibit
            name={exhibitName}
            work={exhibitWork}
            sectionLabel={exhibitSection}
            missionLabel={exhibitMission}
            groundLabel={exhibitGround}
            fxLabel={exhibitFxLabel}
            fx={exhibitFx}
          />
          <DissolveOverlay dissolveRef={portal} rootRef={rootRef} />
        </>
      ) : null}
      <GateFrame
        ref={gateRef}
        metalSrc={metalSrc}
        logoSrc={logoSrc}
        stage={
          <div className="hero-rocket" aria-hidden="true">
            <HeroRocket poseRef={rocketPose} />
          </div>
        }
      >
        <GateNav
          logoSrc={logoSrc}
          contactIconSrc={contactIconSrc}
          menuIconSrc={menuIconSrc}
          label={nav.label}
          brand={nav.brand}
          contactLabel={nav.contact}
          menuLabel={nav.menu}
          menuOpen={menuOpen}
          onMenuToggle={toggleMenu}
          menuButtonRef={menuButtonRef}
        />
      </GateFrame>
      <CircularMenu
        open={menuOpen}
        items={menu.items}
        label={menu.label}
        closeLabel={menu.close}
        onClose={toggleMenu}
        centerIconSrc={menuIconSrc}
      />
    </div>
  );
}
