import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef, useState, type MouseEvent } from 'react';

import {
  CircularMenu,
  type CircularMenuItem,
} from '@/components/ui/CircularMenu';
import { DissolveOverlay } from '@/components/ui/DissolveOverlay';
import { GateFrame } from '@/components/ui/GateFrame';
import { GateNav } from '@/components/ui/GateNav';
import { HeroRocket } from '@/components/ui/HeroRocket';
import { type PartnerLogo } from '@/components/ui/PartnersMarquee';
import { RocketExhibit } from '@/components/ui/RocketExhibit';
import type { MissionConceptCopy } from '@/components/ui/MissionConceptOverlay';
import type {
  GroundSegmentCopy,
  GroundSegmentPhoto,
} from '@/components/ui/GroundSegmentOverlay';
import { SeeMoreCue } from '@/components/ui/SeeMoreCue';
import { SpecularButton } from '@/components/ui/SpecularButton';
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
  holdChallengeTitle: string;
  holdChallengeBody: string;
  holdGoalTitle: string;
  holdGoalBody: string;
  exhibitName: string;
  exhibitWork: string;
  exhibitSection: string;
  exhibitMission: string;
  exhibitMissionCopy: MissionConceptCopy;
  exhibitGround: string;
  exhibitGroundCopy: GroundSegmentCopy;
  exhibitGroundPhotos: GroundSegmentPhoto[];
  exhibitFxLabel: string;
  partnersTitle: string;
  partnersAria: string;
  partnerLogos: PartnerLogo[];
  aboutTitle: string;
  aboutBody: string;
  aboutPhotoSrc: string;
  aboutPhotoAlt: string;
  aboutPhotoWidth: number;
  aboutPhotoHeight: number;
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

// Warp at the deepest point of the push. Hold keeps climbing from there.
const WARP = { speed: 8, zoom: 2.2 } as const;

// Gate / interior zoom. Keep this duration; SCROLL_LENGTH is sized so
// this beat still eats the same viewport distance when the fly pose grows.
const ZOOM_DURATION = 0.7;

// See More click. Viewport heights from the pin start. Not the flyby clock —
// that ratio was collapsing to 1 and dumping into the exhibit.
// 0.55 ≈ half a screen (panes start to leave). Raise to go further.
const SEE_MORE_VIEWPORTS = 0.55;

// Lift / tilt / roll to the diagonal. Starts near the end of the zoom,
// then runs past it. No extra roll after it parks.
const ROCKET_FLY_START = 0.52;
const ROCKET_FLY_DURATION = 0.4;
const FLY_POSE_END = ROCKET_FLY_START + ROCKET_FLY_DURATION;

// Diagonal hold: texts start only once the rocket is parked diagonal.
// "Further out" is scale, not an earlier clock. Fade in, keep growing,
// sit readable, fade out as the zoom passes them. Gap before the split.
// HOLD_IN / HOLD_OUT = opacity clocks. HOLD_VISIBLE = full-opacity grow.
// HOLD_ZOOM = diagonal-text scale only. Never alias ZOOM_DURATION.
const HOLD_SCALE_FROM = 0.4;
const HOLD_IN = 0.3;
const HOLD_VISIBLE = 0.05;
const HOLD_OUT = 0.22;
const HOLD_GAP = 0.1;
const HOLD_START = FLY_POSE_END;
const HOLD_OUT_AT = HOLD_START + HOLD_IN + HOLD_VISIBLE;
const HOLD_END = HOLD_OUT_AT + HOLD_OUT + HOLD_GAP;
const HOLD_ZOOM = 0.77;

// Pins the flyby clock so hold tweaks cannot compress the title zoom.
// Sized to this hold window (rays end ≈ 2.576). Title mapping stays
// 0.7 / lock * scroll ≈ pre-hold 1.28 viewports.
const FLYBY_LOCK = 2.58;

const EXPLODE_DURATION = 0.45;
// Timeline units after explode starts. 0 = hole with the first crack.
// Bigger = later hole. 0.12 ≈ parts already a little apart.
const DISSOLVE_DELAY = 0.075;
// Rails start once the hole has begun. Rays wait — their bloom sits at
// the top, still covered if they share the rail lag.
const RAIL_SLIDE_LAG = 0.18;
const RAY_SLIDE_LAG = 0.58;
const RAIL_SLIDE_DURATION = 0.45;

// Pin length: first-title zoom matches pre-hold (311% at duration 1.706).
// Lock is 2.58, so 365 * 2.58 / 2 ≈ 471. Hold knobs do not touch this.
const SCROLL_LENGTH = '+=471%';

// Void ascent, after the pin. Units are that timeline's own clock.
// Rails travel 100vw with power2.in, so they clip off-screen around
// CAPTION_EXIT — Commodore must hit 0 then, not at HUD_EXIT.
// VEIL_FULL is oversized so the gradient's soft head clears the top edge.
// Solid void band starts at 68% of veil height (see .rocket-exhibit-veil).
const HUD_EXIT = 0.45;
const CAPTION_EXIT = HUD_EXIT * 0.42;
const VEIL_RISE = 0.75;
const STARS_IN = 0.25;
const VEIL_REST = 38;
const VEIL_FULL = 340;
const VEIL_SOLID = 0.68;
const STARS_AT =
  VEIL_RISE * ((100 / VEIL_SOLID - VEIL_REST) / (VEIL_FULL - VEIL_REST));
// Content waits this much ascent progress after the field is up, then
// fades in from below. Stars keep the earlier cover beat.
const CONTENT_LAG = 0.14;
const CONTENT_IN = 0.42;
const CONTENT_RISE = 0.08;
const VOID_COVER = STARS_AT / VEIL_RISE;
const VOID_CONTENT_AT = VOID_COVER + CONTENT_LAG;

// Full viewport drop: panes travel off-screen during the open, so parking
// behind the bottom pane is not enough. The GLB still loads in that hole.
const ROCKET_ENTRY = 100;
const ROCKET_ENTRY_DURATION = 1.4;

// How long the gate takes to shut behind the menu, and to reopen after it.
const DOOR_DURATION = 0.9;
// Head start the dial's flicker-out gets before the gate reopens.
const MENU_EXIT = 0.45;

function paneScaleAt(flyby: gsap.core.Timeline) {
  const time = flyby.time();
  if (!Number.isFinite(time) || time <= 0) return 1;
  if (time >= ZOOM_DURATION) return FLYBY_SCALE;
  return 1 + (FLYBY_SCALE - 1) * (time / ZOOM_DURATION);
}

function holdCopyAlphaAt(flyby: gsap.core.Timeline) {
  const time = flyby.time();
  if (time < HOLD_START) return 0;
  if (time < HOLD_START + HOLD_IN) return (time - HOLD_START) / HOLD_IN;
  if (time < HOLD_OUT_AT) return 1;
  if (time < HOLD_OUT_AT + HOLD_OUT) {
    return 1 - (time - HOLD_OUT_AT) / HOLD_OUT;
  }
  return 0;
}

function scrollToHeroSection(
  id: string,
  flyby: gsap.core.Timeline | null,
  extra: { immediate?: boolean } = {},
) {
  const lenis = getSmoothScroll();
  const options = { force: true, ...extra };

  if (id === 'home') {
    lenis.scrollTo(0, options);
    return;
  }

  if (id === 'our-work') {
    const trigger = flyby?.scrollTrigger;
    if (trigger) {
      lenis.scrollTo(Math.max(trigger.start, trigger.end - 8), options);
      return;
    }
    const ascent = document.querySelector('#after-hero');
    if (ascent instanceof HTMLElement) {
      lenis.scrollTo(
        Math.max(0, ascent.offsetTop - window.innerHeight),
        options,
      );
    }
    return;
  }

  // About lives on a fixed overlay. The void spacer is the scroll beat
  // where that panel is actually on screen.
  if (id === 'about') {
    const ascent = document.querySelector('#after-hero');
    const trigger = ScrollTrigger.getAll().find((st) => st.trigger === ascent);
    if (trigger) {
      const progress = Math.min(0.85, VOID_CONTENT_AT + 0.08);
      lenis.scrollTo(
        trigger.start + (trigger.end - trigger.start) * progress,
        options,
      );
      return;
    }
    if (ascent instanceof HTMLElement) {
      lenis.scrollTo(ascent.offsetTop + window.innerHeight * 0.2, options);
      return;
    }
    lenis.scrollTo('#after-hero', options);
    return;
  }

  lenis.scrollTo(`#${id}`, options);
}

// Numeric scrub eases the playhead toward the scrollbar. An immediate
// jump only moves scroll — the scene still catches up for a second.
// Set the playhead only. Recreating the scrub tween (scrubDuration)
// was killing in-flight door tweens and could throw mid-jump.
function snapScrubbedTrigger(st: ScrollTrigger) {
  const anim = st.animation;
  if (!anim) return;
  try {
    gsap.killTweensOf(anim);
    if (st.vars.scrub) {
      anim.totalProgress(st.progress);
      return;
    }
    anim.progress(ScrollTrigger.scroll() >= st.start ? 1 : 0);
  } catch {
    // A stale trigger must not block the door reopen.
  }
}

export function LandingHero({
  metalSrc,
  logoSrc,
  contactIconSrc,
  menuIconSrc,
  label,
  headline,
  subtitle,
  seeMore,
  holdChallengeTitle,
  holdChallengeBody,
  holdGoalTitle,
  holdGoalBody,
  exhibitName,
  exhibitWork,
  exhibitSection,
  exhibitMission,
  exhibitMissionCopy,
  exhibitGround,
  exhibitGroundCopy,
  exhibitGroundPhotos,
  exhibitFxLabel,
  partnersTitle,
  partnersAria,
  partnerLogos,
  aboutTitle,
  aboutBody,
  aboutPhotoSrc,
  aboutPhotoAlt,
  aboutPhotoWidth,
  aboutPhotoHeight,
  nav,
  menu,
  introDuration = 2.6,
}: LandingHeroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const holdMenuButtonRef = useRef<HTMLButtonElement>(null);
  const menuSourceRef = useRef<'gate' | 'hold'>('gate');
  const paneScaleRef = useRef(1);
  const holdCopyAlphaRef = useRef(0);
  // 0 = flyby owns the panes. 1 = slammed shut. Applied after ScrollTrigger
  // each tick so the flyby scale tween cannot overwrite the door.
  const menuGate = useRef({ blend: 0 });
  const warpRef = useRef<StarfieldWarp>({ speed: 1, zoom: 1 });
  const rocketPose = useRef<RocketPose>({ ...REST_ROCKET_POSE });
  const portal = useRef({ ...REST_PORTAL });
  const [introDone, setIntroDone] = useState(false);
  // Two flags rather than one: the gate leads the dial in and trails it out,
  // and while they disagree a transition is still running.
  const [gateShut, setGateShut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exhibitFx, setExhibitFx] = useState(false);
  const flybyRef = useRef<gsap.core.Timeline | null>(null);
  // While a menu jump settles, void fades must snap — not tween.
  const jumpingRef = useRef(false);
  const snapSceneRef = useRef<() => void>(() => {});

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
    const applyMenuGate = () => {
      const blend = menuGate.current.blend;
      const gate = gateRef.current;
      if (blend <= 0 || !gate) return;
      const geometry = readGateGeometry(gate);
      const scale = gsap.utils.interpolate(paneScaleRef.current, 1, blend);
      gsap.set(gate.querySelector('.gate-pane-group--top'), {
        scale,
        yPercent: gsap.utils.interpolate(geometry.restTop, 0, blend),
      });
      gsap.set(gate.querySelector('.gate-pane-group--bottom'), {
        scale,
        yPercent: gsap.utils.interpolate(geometry.restBottom, 0, blend),
      });
    };
    // After ScrollTrigger so the slammed door wins the same frame.
    gsap.ticker.add(applyMenuGate);
    // Scrub reacts to scroll deltas, so a frame the tab dropped must not be
    // smoothed away into a jump.
    gsap.ticker.lagSmoothing(0);

    return () => {
      unsubscribe();
      gsap.ticker.remove(drive);
      gsap.ticker.remove(applyMenuGate);
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
            gsap.set('.hold-copy', { autoAlpha: 1, scale: 1 });
            gsap.set('.hold-menu', { yPercent: 0, autoAlpha: 1 });
            gsap.set('.hero-rocket', { yPercent: 0 });
            return;
          }

          gsap.set(rocketPose.current, { ...REST_ROCKET_POSE });
          gsap.set(portal.current, { ...REST_PORTAL });
          gsap.set('.landing-copy', { autoAlpha: 0 });
          gsap.set('.see-more', { autoAlpha: 0 });
          gsap.set('.hold-copy', {
            autoAlpha: 0,
            scale: HOLD_SCALE_FROM,
            transformOrigin: '50% 50%',
          });
          gsap.set('.hold-menu', { yPercent: -160, autoAlpha: 0 });
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
                gsap.set(
                  '.gate-pane-group, .hero-interior, .hold-copy, .hold-menu',
                  {
                    willChange: self.isActive ? 'transform' : 'auto',
                  },
                ),
            },
          });
          flyby.scrollTrigger?.disable();

          const ascent = document.querySelector('.void-ascent');
          const stars = root.querySelector('.void-stars');
          const content = root.querySelector('.void-content');
          let ascentTrigger: ScrollTrigger | undefined;
          let paintVoidNow: ((progress: number) => void) | undefined;
          if (ascent instanceof HTMLElement && stars instanceof HTMLElement) {
            const rise = () => window.innerHeight * CONTENT_RISE;
            gsap.set(stars, { opacity: 0 });
            if (content instanceof HTMLElement) {
              gsap.set(content, { opacity: 0, y: rise });
            }
            // Cover is a fraction of the veil climb. Fade is time-based, not
            // scrubbed: reversing the wheel must not rewind the field.
            const exhibit = root.querySelector('.rocket-exhibit');
            let starsOn = false;
            let contentOn = false;
            const paintVoid = (progress: number, instant: boolean) => {
              const showStars = progress >= VOID_COVER;
              const showContent = progress >= VOID_CONTENT_AT;
              if (showStars !== starsOn || instant) {
                starsOn = showStars;
                exhibit?.classList.toggle('is-void', showStars);
                root.classList.toggle('is-void', showStars);
                gsap.to(stars, {
                  opacity: showStars ? 1 : 0,
                  duration: instant ? 0 : STARS_IN,
                  ease: 'none',
                  overwrite: true,
                });
              }
              if (
                content instanceof HTMLElement &&
                (showContent !== contentOn || instant)
              ) {
                contentOn = showContent;
                gsap.to(content, {
                  opacity: showContent ? 1 : 0,
                  y: showContent ? 0 : rise(),
                  duration: instant ? 0 : CONTENT_IN,
                  ease: showContent ? 'power2.out' : 'power2.in',
                  overwrite: true,
                });
              }
            };
            const voidTl = gsap
              .timeline({
                scrollTrigger: {
                  trigger: ascent,
                  start: 'top bottom',
                  end: 'bottom bottom',
                  scrub: true,
                  onUpdate: (self) => {
                    paintVoid(self.progress, jumpingRef.current);
                  },
                },
              })
              // Rails retract the way they arrived; Commodore fades + drops.
              // Same clock as the veil climb — nothing leaves before black moves.
              .to(
                '.rocket-exhibit-rail--left',
                { x: '-100vw', ease: 'power2.in', duration: HUD_EXIT },
                0,
              )
              .to(
                '.rocket-exhibit-rail--right',
                { x: '100vw', ease: 'power2.in', duration: HUD_EXIT },
                0,
              )
              .to(
                '.rocket-exhibit-caption',
                {
                  y: () => window.innerHeight * 0.12,
                  autoAlpha: 0,
                  ease: 'power2.in',
                  duration: CAPTION_EXIT,
                },
                0,
              )
              // Grows past the viewport so even the gradient's soft head
              // clears the top: the whole frame ends on void.
              .fromTo(
                '.rocket-exhibit',
                { '--exhibit-veil-height': `${VEIL_REST}svh` },
                {
                  '--exhibit-veil-height': `${VEIL_FULL}svh`,
                  ease: 'none',
                  duration: VEIL_RISE,
                },
                0,
              )
              .to(
                '.rocket-exhibit-work',
                {
                  y: () => -window.innerHeight * 0.12,
                  autoAlpha: 0,
                  ease: 'none',
                  duration: VEIL_RISE * 0.5,
                },
                0,
              );
            ascentTrigger = voidTl.scrollTrigger;
            paintVoidNow = (progress) => paintVoid(progress, true);
          }

          // The exhibit is a fixed overlay that never scrolls away on its own,
          // so the contact screen underneath only gets the frame once the
          // overlay is faded off it. The panel loses its hit area first, or a
          // still-translucent glass sheet would swallow clicks on the form.
          const contact = document.querySelector('#contact');
          if (contact instanceof HTMLElement) {
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: contact,
                  start: 'top bottom',
                  end: 'top 35%',
                  scrub: true,
                },
              })
              .to('.rocket-exhibit', {
                autoAlpha: 0,
                ease: 'none',
                duration: 1,
              })
              .set('.void-panel', { pointerEvents: 'none' }, 0.05);
          }

          snapSceneRef.current = () => {
            ScrollTrigger.update();
            for (const st of ScrollTrigger.getAll()) {
              snapScrubbedTrigger(st);
            }
            if (ascentTrigger && paintVoidNow) {
              paintVoidNow(ascentTrigger.progress);
            }
          };

          flyby.eventCallback('onUpdate', () => {
            root
              .querySelector('.rocket-exhibit')
              ?.classList.toggle(
                'is-live',
                flyby.time() >= HOLD_OUT_AT + HOLD_OUT,
              );
          });
          flybyRef.current = flyby;

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
              {
                speed: 5.5,
                zoom: 2.6,
                ease: 'none',
                duration: HOLD_START - ZOOM_DURATION,
              },
              ZOOM_DURATION,
            )
            .to(
              '.hold-copy',
              {
                scale: INTERIOR_SCALE,
                ease: 'none',
                duration: HOLD_ZOOM,
              },
              HOLD_START,
            )
            .to(
              '.hold-copy',
              {
                autoAlpha: 1,
                ease: 'none',
                duration: HOLD_IN,
              },
              HOLD_START,
            )
            .to(
              warpRef.current,
              {
                speed: 6.2,
                zoom: 5.0,
                ease: 'none',
                duration: HOLD_END - HOLD_START,
              },
              HOLD_START,
            )
            .to(
              '.hold-copy',
              {
                autoAlpha: 0,
                ease: 'none',
                duration: HOLD_OUT,
              },
              HOLD_OUT_AT,
            )
            // No out tween. Past the diagonal the control stays put so later
            // screens still have a way back into the dial. Scroll back before
            // HOLD_START reverses this and it slides up out of view.
            .fromTo(
              '.hold-menu',
              { yPercent: -160, autoAlpha: 0 },
              {
                yPercent: 0,
                autoAlpha: 1,
                ease: 'none',
                duration: HOLD_IN,
                immediateRender: false,
              },
              HOLD_START,
            );

          if (ROCKET_DISASSEMBLE) {
            flyby.to(
              rocketPose.current,
              { explode: 1, ease: 'none', duration: EXPLODE_DURATION },
              HOLD_END,
            );
          }

          if (ROCKET_PORTAL) {
            const dissolveAt = HOLD_END + DISSOLVE_DELAY;
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

            // Opacity only — autoAlpha would flip visibility and hitch every
            // time the playhead crosses this mark. Warm once the panes and
            // first title are gone (ZOOM_DURATION). Overlay at dissolve 0
            // still looks like the flyby; hold-copy sits above it (z 56).
            // Explode / hole then only tween uniforms — no first paint.
            flyby.set('.rocket-exhibit, .dissolve-overlay', { opacity: 0 }, 0);
            flyby.set(
              '.rocket-exhibit, .dissolve-overlay',
              { opacity: 1 },
              ZOOM_DURATION,
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
          }

          flyby.set({}, {}, FLYBY_LOCK);

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
                if (ROCKET_PORTAL) setExhibitFx(true);
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

      return () => {
        flybyRef.current = null;
        snapSceneRef.current = () => {};
        media.revert();
      };
    },
    { scope: rootRef },
  );

  /**
   * Shuts the gate on the way in and reopens it on the way out, with the dial
   * held to the stretch where the panes are still. Ignored mid-transition.
   */
  const slamPanes = (
    source: 'gate' | 'hold',
    onComplete: () => void,
  ) => {
    const gate = gateRef.current;
    if (!gate) return;

    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const duration = reduce ? 0 : DOOR_DURATION;

    menuSourceRef.current = source;
    paneScaleRef.current =
      Number(gsap.getProperty('.gate-pane-group--top', 'scale')) || 1;
    holdCopyAlphaRef.current =
      Number(gsap.getProperty('.hold-copy', 'autoAlpha')) || 0;
    setGateShut(true);
    gate.classList.add('is-menu');
    if (source === 'hold') gate.classList.add('is-menu-hold');
    const open = gsap.timeline({ onComplete });
    // Pane slam is the blend — flyby still writes scale every tick, so a
    // direct tween on the groups loses. Hold opener leaves the rocket
    // put; panes just close over the scene.
    open.to(
      menuGate.current,
      { blend: 1, duration, ease: 'power2.inOut' },
      0,
    );
    if (source === 'gate') {
      open.to(
        '.hero-rocket',
        {
          yPercent: ROCKET_ENTRY,
          duration: reduce ? 0 : duration * 1.2,
          ease: 'power2.in',
        },
        0,
      );
    }
    open
      .to('.gate-nav', { autoAlpha: 0, duration: duration * 0.3 }, 0)
      .to('.hold-copy', { autoAlpha: 0, duration: duration * 0.25 }, 0);
  };

  const runToggle = (source: 'gate' | 'hold' = 'gate') => {
    const gate = gateRef.current;
    if (!gate) return;
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const duration = reduce ? 0 : DOOR_DURATION;
    // Jump died after slam: door shut, dial gone. Let this click reopen.
    if (gateShut && !menuOpen) {
      openPanes({
        duration,
        reduce,
        moveRocket: menuSourceRef.current === 'gate' || source === 'gate',
        delay: 0,
      });
      return;
    }
    if (gateShut !== menuOpen) return;

    if (!menuOpen) {
      slamPanes(source, () => setMenuOpen(true));
      return;
    }

    setMenuOpen(false);
    openPanes({
      duration,
      reduce,
      moveRocket: menuSourceRef.current === 'gate',
      delay: reduce ? 0 : MENU_EXIT,
    });
  };

  const openPanes = ({
    duration,
    reduce,
    moveRocket,
    delay,
  }: {
    duration: number;
    reduce: boolean;
    moveRocket: boolean;
    delay: number;
  }) => {
    const gate = gateRef.current;
    if (!gate) return;
    const fromHold = menuSourceRef.current === 'hold';

    const close = gsap.timeline({
      onComplete: () => {
        gate.classList.remove('is-menu', 'is-menu-hold');
        setGateShut(false);
        if (fromHold) {
          holdMenuButtonRef.current?.focus();
          return;
        }
        menuButtonRef.current?.focus();
      },
    });
    close.to(
      menuGate.current,
      { blend: 0, duration, ease: 'power2.inOut' },
      delay,
    );
    if (moveRocket) {
      close.to(
        '.hero-rocket',
        {
          yPercent: 0,
          duration: reduce ? 0 : duration * 2.1,
          ease: 'power2.out',
        },
        delay,
      );
    }
    close
      .to('.gate-nav', { autoAlpha: 1, duration: duration * 0.3 }, '>-0.35')
      .to(
        '.hold-copy',
        {
          autoAlpha: holdCopyAlphaRef.current,
          duration: duration * 0.3,
        },
        delay,
      );
  };

  // Wrapped at click time rather than during render: the wrapper reads refs,
  // and the scoping and cleanup it adds are the same either way.
  const toggleMenu = (source: 'gate' | 'hold' = 'gate') =>
    contextSafe(() => runToggle(source))();

  const jumpToSection = (id: string) => {
    jumpingRef.current = true;
    scrollToHeroSection(id, flybyRef.current, { immediate: true });

    const finish = () => {
      try {
        snapSceneRef.current();
        if (id === 'contact' || id === 'gallery') {
          gsap.set('.rocket-exhibit', { autoAlpha: 0 });
          gsap.set('.void-panel', { pointerEvents: 'none' });
        }
        const flyby = flybyRef.current;
        if (flyby) {
          paneScaleRef.current = paneScaleAt(flyby);
          holdCopyAlphaRef.current = holdCopyAlphaAt(flyby);
        }
      } finally {
        jumpingRef.current = false;
        const reduce = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;
        openPanes({
          duration: reduce ? 0 : DOOR_DURATION,
          reduce,
          moveRocket: id === 'home',
          delay: 0,
        });
      }
    };

    requestAnimationFrame(() => finish());
  };

  const arriveThenOpen = (id: string) => {
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    setMenuOpen(false);
    gsap.delayedCall(reduce ? 0 : MENU_EXIT, () => jumpToSection(id));
  };

  const coverThenArrive = (id: string) => {
    slamPanes('gate', () => jumpToSection(id));
  };

  const navigateTo = (id: string) => {
    if (gateShut !== menuOpen) return;
    if (menuOpen) {
      contextSafe(() => arriveThenOpen(id))();
      return;
    }
    contextSafe(() => coverThenArrive(id))();
  };

  const skipToPanesClear = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const trigger = flybyRef.current?.scrollTrigger;
    const lenis = getSmoothScroll();
    if (!trigger) {
      lenis.scrollTo('#after-hero');
      return;
    }
    trigger.enable();
    const top = trigger.start + window.innerHeight * SEE_MORE_VIEWPORTS;
    if (!Number.isFinite(top)) return;
    lenis.scrollTo(top);
  };

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
          <SeeMoreCue
            label={seeMore}
            href="#after-hero"
            onClick={skipToPanesClear}
          />
        </div>
      </section>
      <div className="hold-copy">
        <div className="hold-block hold-block--challenge">
          <h2 className="hold-title">
            <span>{holdChallengeTitle}</span>
          </h2>
          <p className="hold-body">{holdChallengeBody}</p>
        </div>
        <div className="hold-block hold-block--goal">
          <h2 className="hold-title">
            <span>{holdGoalTitle}</span>
          </h2>
          <p className="hold-body">{holdGoalBody}</p>
        </div>
      </div>
      <div className="hold-menu" data-open={menuOpen}>
        <SpecularButton
          ref={holdMenuButtonRef}
          className="hold-menu-btn"
          aria-label={nav.menu}
          aria-expanded={menuOpen}
          aria-controls="gate-menu"
          onClick={() => toggleMenu('hold')}
        >
          <img src={menuIconSrc} alt="" className="hold-menu-icon" />
        </SpecularButton>
      </div>
      {ROCKET_PORTAL ? (
        <>
          <RocketExhibit
            name={exhibitName}
            work={exhibitWork}
            sectionLabel={exhibitSection}
            missionLabel={exhibitMission}
            missionCopy={exhibitMissionCopy}
            groundLabel={exhibitGround}
            groundCopy={exhibitGroundCopy}
            groundPhotos={exhibitGroundPhotos}
            fxLabel={exhibitFxLabel}
            fx={exhibitFx}
            partnersTitle={partnersTitle}
            partnersAria={partnersAria}
            partnerLogos={partnerLogos}
            aboutTitle={aboutTitle}
            aboutBody={aboutBody}
            aboutPhotoSrc={aboutPhotoSrc}
            aboutPhotoAlt={aboutPhotoAlt}
            aboutPhotoWidth={aboutPhotoWidth}
            aboutPhotoHeight={aboutPhotoHeight}
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
          onMenuToggle={() => toggleMenu('gate')}
          onContact={() => navigateTo('contact')}
          menuButtonRef={menuButtonRef}
        />
      </GateFrame>
      <CircularMenu
        open={menuOpen}
        items={menu.items}
        label={menu.label}
        closeLabel={menu.close}
        onClose={() => toggleMenu(menuSourceRef.current)}
        onNavigate={(item) => navigateTo(item.id)}
        centerIconSrc={menuIconSrc}
      />
    </div>
  );
}
