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

// Coarse reject only. Real hit is the WebGL silhouette (body + fins).
export const EXHIBIT_HULL_SLENDERNESS = 0.32;

// Extra CSS pixels around the silhouette so thin fin edges still count.
export const EXHIBIT_XRAY_HIT_PAD = 6;

// Horizontal exhibit fills this fraction of the viewport width.
export const EXHIBIT_FILL = 0.88;

// Nudge the exhibit so the name overlay clears the cradles, and so the
// fin-heavy tail does not pull the silhouette left of centre.
export const EXHIBIT_X = 0.0125;
export const EXHIBIT_Y = 0.0125;

// Internals ride the 3D rocket. SCALE = PNG width / rocket length.
// NUDGE = PNG centre minus rocket centre, in rocket-lengths.
// +X right, +Y up. Frozen from the lined-up pose (FILL 0.88).
export const EXHIBIT_XRAY_SCALE = 0.7;
export const EXHIBIT_XRAY_NUDGE_X = -0.0725 / 0.88;
export const EXHIBIT_XRAY_NUDGE_Y = 0;

// Hole radius as a fraction of the shorter viewport side.
export const EXHIBIT_XRAY_HOLE = 0.15;

export type ExhibitXrayBox = {
  imgW: number;
  imgH: number;
  imgX: number;
  imgY: number;
};

/** Screen box for the internals PNG, locked to the exhibit rocket. */
export function exhibitXrayBox(
  viewW: number,
  viewH: number,
  plateAspect: number,
): ExhibitXrayBox {
  const rocketW = viewW * EXHIBIT_FILL;
  const rocketCx = viewW * 0.5 + EXHIBIT_X * viewW;
  const rocketCy = viewH * 0.5 - EXHIBIT_Y * viewH;
  const imgW = rocketW * EXHIBIT_XRAY_SCALE;
  const imgH = imgW * plateAspect;
  return {
    imgW,
    imgH,
    imgX: rocketCx - imgW * 0.5 + EXHIBIT_XRAY_NUDGE_X * rocketW,
    imgY: rocketCy - imgH * 0.5 - EXHIBIT_XRAY_NUDGE_Y * rocketW,
  };
}
