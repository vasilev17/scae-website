/**
 * Section-view callouts: one marker per part the cut opens up.
 *
 * Authored in the rocket's own frame so a single set of numbers serves both
 * the horizontal exhibit and the upright portrait band. `u` runs the long
 * axis, 0 at the aft-most point of the silhouette to 1 at the nose tip; `v`
 * is the lateral offset in rocket-lengths, +v toward the model's +X side.
 */

import {
  EXHIBIT_ROCKET_POSE,
  exhibitFloat,
  exhibitRocketBaseOffset,
  exhibitRocketLength,
  exhibitRocketTilt,
} from '@/lib/rocket';

export const ROCKET_HOTSPOT_IDS = [
  'fins',
  'engine',
  'parachute',
  'pyro',
  'avionics',
  'nose',
] as const;

export type RocketHotspotId = (typeof ROCKET_HOTSPOT_IDS)[number];

export type RocketHotspot = {
  id: RocketHotspotId;
  u: number;
  v: number;
};

/** Tail to nose, the order the cut reads in. */
export const ROCKET_HOTSPOTS: readonly RocketHotspot[] = [
  { id: 'fins', u: 0.055, v: 0.085 },
  { id: 'engine', u: 0.15, v: 0 },
  { id: 'parachute', u: 0.472, v: 0.028 },
  { id: 'pyro', u: 0.565, v: 0 },
  { id: 'avionics', u: 0.685, v: 0 },
  { id: 'nose', u: 0.85, v: 0 },
];

export type HotspotPoint = { x: number; y: number };

/**
 * Marker centre in stage CSS pixels. `float` folds in the exhibit bob, so a
 * frame loop can re-place the markers without a fresh measure.
 */
export function hotspotPoint(
  spot: RocketHotspot,
  stageW: number,
  stageH: number,
  portrait: boolean,
  float = false,
): HotspotPoint {
  const length = exhibitRocketLength(stageW, stageH, portrait);
  const base = exhibitRocketBaseOffset(portrait);
  const bob = float ? exhibitFloat.y : 0;
  const cx = stageW * 0.5 + base.x * stageW;
  const cy = stageH * 0.5 - (base.y + bob) * stageH;

  // Same roll RocketScene gives the exhibit group: model +Y is the nose.
  const angle =
    EXHIBIT_ROCKET_POSE.tilt +
    exhibitRocketTilt(portrait) +
    (float ? exhibitFloat.pitch : 0);
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const localX = spot.v * length;
  const localY = (spot.u - 0.5) * length;

  return {
    x: cx + localX * cos - localY * sin,
    y: cy - (localX * sin + localY * cos),
  };
}
