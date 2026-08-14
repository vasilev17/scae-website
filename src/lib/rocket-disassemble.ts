/**
 * Scroll explode for the 9 CAD parts. Flip `ROCKET_DISASSEMBLE` to kill the
 * animation without touching the bake. To restore the old joined blob as well:
 * set KEEP_NAMED_PARTS false in scripts/build-rocket-model.mjs and rebuild,
 * or point RocketScene at `@/assets/generated/rocket-joined.glb`.
 */

export const ROCKET_DISASSEMBLE = true;

export const ROCKET_PART_IDS = [
  'fin-neg-x',
  'fin-pos-x',
  'fin-pos-z',
  'fin-neg-z',
  'tail',
  'case',
  'fuselage',
  'bay',
  'nose',
] as const;

export type RocketPartId = (typeof ROCKET_PART_IDS)[number];

const PART_ID_SET: ReadonlySet<string> = new Set(ROCKET_PART_IDS);

export function isRocketPartId(name: string): name is RocketPartId {
  return PART_ID_SET.has(name);
}

/**
 * Model-space metres at explode = 1. Rocket height is ~1.275 m and fills the
 * viewport, so ~1 here is roughly one screen height. Local frame: +Y nose,
 * +Z toward the camera, before the fly tilt/spin.
 */
const BODY = [0, 0.45, 0] as const;

export const ROCKET_PART_OFFSETS: Record<
  RocketPartId,
  readonly [number, number, number]
> = {
  'fin-neg-x': [-1.2, 0, 0],
  'fin-pos-x': [1.2, 0, 0],
  'fin-pos-z': [0, 0, 1.1],
  'fin-neg-z': [0, 0, -1.1],
  // Inner orange stays nested in the tube — same offset, one body.
  tail: BODY,
  fuselage: BODY,
  bay: [0, 0.7, 0],
  case: [0, -1.45, 0],
  nose: [0, 1.15, 0],
};
