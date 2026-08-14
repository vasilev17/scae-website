import {
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type RefObject,
} from 'react';

import { type RocketPose } from '@/lib/rocket';

const RETRY_MS = 400;

type HeroRocketProps = {
  poseRef: RefObject<RocketPose>;
};

type RocketSceneComponent = ComponentType<{ poseRef: RefObject<RocketPose> }>;

/**
 * The hero island is `client:load`, so three.js must not enter its SSR tree.
 * The scene module is fetched after paint, then rendered in this same React
 * tree (Suspense can resolve `useLoader` here; a second `createRoot` cannot).
 *
 * Vite can 504 the first fetch while it rebundles three.js. One retry covers
 * that window; a real load error still lands in the console.
 */
export function HeroRocket({ poseRef }: HeroRocketProps) {
  const [Scene, setScene] = useState<RocketSceneComponent | null>(null);

  useEffect(() => {
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

  if (!Scene) return null;

  return (
    <Suspense fallback={null}>
      <Scene poseRef={poseRef} />
    </Suspense>
  );
}
