import {
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type RefObject,
} from 'react';

import posterExhibit from '@/assets/generated/rocket-poster-exhibit.webp?url';
import posterFlyby from '@/assets/generated/rocket-poster-flyby.webp?url';
import { getQualityTier, type QualityTier } from '@/lib/quality';
import { type RocketPose, type RocketView, type SectionState } from '@/lib/rocket';
import { useQualityTier } from '@/lib/use-quality-tier';

const RETRY_MS = 400;

type HeroRocketProps = {
  poseRef: RefObject<RocketPose>;
  view?: RocketView;
  sectionRef?: RefObject<SectionState>;
  running?: boolean;
};

type RocketSceneComponent = ComponentType<{
  poseRef: RefObject<RocketPose>;
  view?: RocketView;
  sectionRef?: RefObject<SectionState>;
  tier: QualityTier;
  running?: boolean;
}>;

/**
 * The hero island is `client:load`, so three.js must not enter its SSR tree.
 * The scene module is fetched after paint, then rendered in this same React
 * tree (Suspense can resolve `useLoader` here; a second `createRoot` cannot).
 *
 * On the `fallback` tier (no WebGL context) the module is never fetched and
 * a baked poster of the parked rocket stands in, so the page stays usable
 * and the three.js chunk never hits the network.
 *
 * Vite can 504 the first fetch while it rebundles three.js. One retry covers
 * that window; a real load error still lands in the console.
 */
export function HeroRocket({
  poseRef,
  view = 'flyby',
  sectionRef,
  running = true,
}: HeroRocketProps) {
  const tier = useQualityTier();
  const [Scene, setScene] = useState<RocketSceneComponent | null>(null);

  useEffect(() => {
    // Read the store directly: the hydration render still carries the server
    // tier, and this effect must not start the import on a fallback device.
    if (getQualityTier() === 'fallback') return;

    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const load = (allowRetry: boolean) => {
      void import('@/components/ui/RocketScene')
        .then(({ RocketScene }) => {
          if (!cancelled) setScene(() => RocketScene);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          if (allowRetry) {
            retry = setTimeout(() => load(false), RETRY_MS);
            return;
          }
          console.error(error);
        });
    };

    load(true);

    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, []);

  if (tier === 'fallback') return <RocketPoster view={view} />;
  if (!Scene) return null;

  return (
    <Suspense fallback={null}>
      <Scene
        poseRef={poseRef}
        view={view}
        sectionRef={sectionRef}
        tier={tier}
        running={running}
      />
    </Suspense>
  );
}

type RocketPosterProps = {
  view: RocketView;
};

// Baked by scripts/build-rocket-poster.mjs from the same GLB, lights and
// paint. The stylesheet parks each frame where the live scene would.
function RocketPoster({ view }: RocketPosterProps) {
  const exhibit = view === 'exhibit';
  return (
    <img
      src={exhibit ? posterExhibit : posterFlyby}
      alt=""
      decoding="async"
      draggable={false}
      className={
        exhibit
          ? 'rocket-poster rocket-poster--exhibit'
          : 'rocket-poster rocket-poster--flyby'
      }
    />
  );
}
