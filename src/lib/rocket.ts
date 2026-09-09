export type RocketPose = {
  lift: number;
  tilt: number;
  spin: number;
  // 0 = assembled, 1 = 9 parts fully apart. Unused when ROCKET_DISASSEMBLE is off.
  explode: number;
};

const invalidators = new Set<() => void>();

export function registerRocketInvalidate(fn: () => void): () => void {
  invalidators.add(fn);
  return () => {
    invalidators.delete(fn);
  };
}

export function invalidateRocketScenes() {
  for (const fn of invalidators) fn();
}

export const REST_ROCKET_POSE: RocketPose = {
  lift: 0,
  tilt: 0,
  spin: 0,
  explode: 0,
};

// A bit past 45°, so the nose reads more to the right.
export const ROCKET_FLY_TILT = -Math.PI / 3;

export const ROCKET_FLY_SPIN = Math.PI * 2;

// Nose right, centred. Exhibit after the portal; explode stays 0.
export const EXHIBIT_ROCKET_POSE: RocketPose = {
  lift: 1,
  tilt: -Math.PI / 2,
  spin: 0,
  explode: 0,
};

export type RocketView = 'flyby' | 'exhibit';

// 0 = assembled exhibit rocket, 1 = CAD section cut.
export type SectionState = { cut: number };

export const REST_SECTION: SectionState = { cut: 0 };

export const EXHIBIT_LAYER_HULL = 1;
export const EXHIBIT_LAYER_CUT = 2;

export const ROCKET_SLENDERNESS = 0.32;

// Extra CSS pixels around the silhouette so thin fin edges still count.
export const EXHIBIT_XRAY_HIT_PAD = 6;

export const EXHIBIT_FILL = 0.88;

export const EXHIBIT_FILL_HEIGHT = 0.92;

export const EXHIBIT_X = 0.0125;
export const EXHIBIT_Y = 0.0125;

// Temporary exhibit test: hide cradles and bob the airframe.
export const EXHIBIT_STANDS = false;
// Temporary: hide ContactShadows under the rocket. Flip true to restore.
export const EXHIBIT_SHADOWS = false;
export const EXHIBIT_FLOAT_AMP = 0.012;
export const EXHIBIT_FLOAT_PERIOD = 5;
// Extra tilt (radians). Velocity of the bob, so the nose leads.
export const EXHIBIT_FLOAT_PITCH = 0.01;

export const exhibitFloat = { y: 0, pitch: 0 };

export function exhibitRocketY() {
  return EXHIBIT_Y + exhibitFloat.y;
}

export function exhibitRocketLength(
  stageW: number,
  stageH: number,
  portrait: boolean,
): number {
  if (portrait) return stageH * EXHIBIT_FILL_HEIGHT;
  return Math.min(
    stageW * EXHIBIT_FILL,
    (stageH * EXHIBIT_FILL_HEIGHT) / ROCKET_SLENDERNESS,
  );
}

// Keeps the fins off the side edges once the airframe swings diagonal.
const FLYBY_MARGIN = 0.92;

export function flybyRocketLength(
  viewW: number,
  viewH: number,
  tilt: number,
): number {
  const across =
    Math.abs(Math.sin(tilt)) + ROCKET_SLENDERNESS * Math.abs(Math.cos(tilt));
  return Math.min(viewH, (viewW * FLYBY_MARGIN) / across);
}

export function exhibitRocketOffset(portrait: boolean) {
  const base = exhibitRocketBaseOffset(portrait);
  return {
    x: base.x,
    y: base.y + exhibitFloat.y,
  };
}

export function exhibitRocketBaseOffset(portrait: boolean) {
  return {
    x: portrait ? 0 : EXHIBIT_X,
    y: portrait ? 0 : EXHIBIT_Y,
  };
}

export function exhibitRocketTilt(portrait: boolean) {
  return portrait ? Math.PI / 2 : 0;
}

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
  rocketCx: number;
  rocketCy: number;
};

export function exhibitXrayBox(
  viewW: number,
  viewH: number,
  plateAspect: number,
  portrait: boolean,
): ExhibitXrayBox {
  const rocketW = exhibitRocketLength(viewW, viewH, portrait);
  const offset = exhibitRocketOffset(portrait);
  const rocketCx = viewW * 0.5 + offset.x * viewW;
  const rocketCy = viewH * 0.5 - offset.y * viewH;
  const imgW = rocketW * EXHIBIT_XRAY_SCALE;
  const imgH = imgW * plateAspect;
  return {
    imgW,
    imgH,
    imgX: rocketCx - imgW * 0.5 + EXHIBIT_XRAY_NUDGE_X * rocketW,
    imgY: rocketCy - imgH * 0.5 - EXHIBIT_XRAY_NUDGE_Y * rocketW,
    rocketCx,
    rocketCy,
  };
}
