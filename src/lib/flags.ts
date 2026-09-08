/**
 * Build-time feature switches. Flip a value and rebuild — no remote fetch.
 * The quality tier is not a flag: it is resolved per device at runtime
 * (src/lib/quality.ts). `qualityDebug` only adds the corner readout.
 */
export const flags = {
  customCursor: false,
  qualityDebug: false,
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof flags;
