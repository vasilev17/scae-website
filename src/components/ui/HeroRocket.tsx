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
  // Exhibit on a portrait phone: nose-up, sized to the stage height.
  portrait?: boolean;
};

type RocketSceneComponent = ComponentType<{
  poseRef: RefObject<RocketPose>;
  view?: RocketView;
  sectionRef?: RefObject<SectionState>;
  tier: QualityTier;
  running?: boolean;
  portrait?: boolean;
}>;

export function HeroRocket({
  poseRef,
  view = 'flyby',
  sectionRef,
  running = true,
  portrait = false,
}: HeroRocketProps) {
  const tier = useQualityTier();
  const [Scene, setScene] = useState<RocketSceneComponent | null>(null);

  useEffect(() => {
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
        portrait={portrait}
      />
    </Suspense>
  );
}

type RocketPosterProps = {
  view: RocketView;
};

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
