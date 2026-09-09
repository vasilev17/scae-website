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

const BODY = [0, 0.45, 0] as const;

// Fins + motor (`case`) share the explode clock but cover less ground.
export const AFT_EXPLODE_SCALE = 0.4;

const AFT_PARTS: ReadonlySet<RocketPartId> = new Set([
  'fin-neg-x',
  'fin-pos-x',
  'fin-pos-z',
  'fin-neg-z',
  'case',
]);

export function explodeTravel(id: RocketPartId, explode: number): number {
  return AFT_PARTS.has(id) ? explode * AFT_EXPLODE_SCALE : explode;
}

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

export const NOSE_SEAT = 0.003;
