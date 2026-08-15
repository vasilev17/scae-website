/**
 * Scroll-driven pose for the hero rocket. Kept out of the R3F module so the
 * landing island can tween it without pulling three.js into SSR.
 *
 * `lift` 0 = resting on the bottom pane, 1 = centred in the viewport.
 * `tilt` is rotation around Z in radians. 0 = nose up, negative = nose up-right.
 * `spin` is roll around the airframe axis (local Y).
 */
export type RocketPose = {
  lift: number;
  tilt: number;
  spin: number;
  // 0 = assembled, 1 = 9 parts fully apart. Unused when ROCKET_DISASSEMBLE is off.
  explode: number;
};

export const REST_ROCKET_POSE: RocketPose = {
  lift: 0,
  tilt: 0,
  spin: 0,
  explode: 0,
};

// A bit past 45°, so the nose reads more to the right.
export const ROCKET_FLY_TILT = -Math.PI / 3;

// One full roll around the long axis while it lifts.
export const ROCKET_FLY_SPIN = Math.PI * 2;

// Nose right, centred. Exhibit after the portal; explode stays 0.
export const EXHIBIT_ROCKET_POSE: RocketPose = {
  lift: 1,
  tilt: -Math.PI / 2,
  spin: 0,
  explode: 0,
};

export type RocketView = 'flyby' | 'exhibit';

// Horizontal exhibit fills this fraction of the viewport width.
export const EXHIBIT_FILL = 0.75;

// Internals PNG is exploded, so it must sit smaller than the assembled tube.
export const EXHIBIT_XRAY_FILL = 0.55;

// Nudge the exhibit so the name overlay clears the cradles, and so the
// fin-heavy tail does not pull the silhouette left of centre.
export const EXHIBIT_X = 0.025;
export const EXHIBIT_Y = 0.06;
