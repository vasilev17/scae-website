/**
 * Build-time feature switches. Flip a value and rebuild — no remote fetch.
 */
export const flags = {
  customCursor: false,
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof flags;
